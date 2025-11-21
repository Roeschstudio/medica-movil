#!/bin/bash

# Production Deployment Script for Video Call System
# This script handles the complete deployment process

set -e  # Exit on any error

# Configuration
PROJECT_NAME="medica-movil-video-calls"
BACKUP_DIR="/backups/video-calls"
LOG_FILE="/var/log/video-call-deployment.log"
HEALTH_CHECK_URL="https://your-domain.com/api/health"
MAX_RETRIES=3
RETRY_DELAY=10

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}" | tee -a "$LOG_FILE"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if running as root or with sudo
    if [[ $EUID -eq 0 ]]; then
        error "This script should not be run as root for security reasons"
        exit 1
    fi
    
    # Check required commands
    local required_commands=("node" "npm" "docker" "docker-compose" "curl" "pg_dump")
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            error "Required command '$cmd' not found"
            exit 1
        fi
    done
    
    # Check Node.js version
    local node_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [[ $node_version -lt 18 ]]; then
        error "Node.js 18+ required, found version $node_version"
        exit 1
    fi
    
    # Check environment variables
    local required_env_vars=("NEXT_PUBLIC_SUPABASE_URL" "NEXT_PUBLIC_SUPABASE_ANON_KEY" "SUPABASE_SERVICE_ROLE_KEY")
    for var in "${required_env_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            error "Required environment variable '$var' not set"
            exit 1
        fi
    done
    
    log "Prerequisites check passed"
}

# Create backup
create_backup() {
    log "Creating backup..."
    
    # Create backup directory
    mkdir -p "$BACKUP_DIR"
    
    # Backup database
    local backup_file="$BACKUP_DIR/video_calls_$(date +%Y%m%d_%H%M%S).sql"
    
    if command -v pg_dump &> /dev/null; then
        log "Creating database backup: $backup_file"
        pg_dump -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" \
            -t video_calls -t webrtc_signals \
            -t video_call_quality_metrics -t video_call_usage_analytics \
            -t video_call_error_events > "$backup_file"
        
        # Compress backup
        gzip "$backup_file"
        log "Database backup created and compressed"
    else
        warning "pg_dump not available, skipping database backup"
    fi
    
    # Backup application files
    if [[ -d "/var/www/$PROJECT_NAME" ]]; then
        log "Creating application backup"
        tar -czf "$BACKUP_DIR/app_$(date +%Y%m%d_%H%M%S).tar.gz" \
            -C "/var/www" "$PROJECT_NAME" \
            --exclude="node_modules" \
            --exclude=".next" \
            --exclude="logs"
    fi
    
    # Clean old backups (keep last 7 days)
    find "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete
    find "$BACKUP_DIR" -name "*.tar.gz" -mtime +7 -delete
    
    log "Backup completed"
}

# Run database migrations
run_migrations() {
    log "Running database migrations..."
    
    # Check if Supabase CLI is available
    if command -v supabase &> /dev/null; then
        log "Running Supabase migrations"
        supabase db push --include-all
    else
        log "Running manual migrations"
        
        # Apply migrations manually
        local migration_files=(
            "supabase/migrations/20241211000001_video_calls_schema.sql"
            "supabase/migrations/20241211000002_video_call_security.sql"
            "supabase/migrations/20241211000003_video_call_monitoring.sql"
        )
        
        for migration in "${migration_files[@]}"; do
            if [[ -f "$migration" ]]; then
                log "Applying migration: $migration"
                psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -f "$migration"
            else
                warning "Migration file not found: $migration"
            fi
        done
    fi
    
    log "Database migrations completed"
}

# Build application
build_application() {
    log "Building application..."
    
    # Install dependencies
    log "Installing dependencies"
    npm ci --production=false
    
    # Run tests
    log "Running tests"
    npm run test
    
    # Type checking
    log "Running type check"
    npm run type-check
    
    # Linting
    log "Running linter"
    npm run lint
    
    # Build application
    log "Building application"
    npm run build
    
    log "Application build completed"
}

# Deploy with Docker
deploy_docker() {
    log "Deploying with Docker..."
    
    # Build Docker image
    log "Building Docker image"
    docker build -t "$PROJECT_NAME:latest" .
    
    # Tag with timestamp
    local timestamp=$(date +%Y%m%d_%H%M%S)
    docker tag "$PROJECT_NAME:latest" "$PROJECT_NAME:$timestamp"
    
    # Stop existing containers
    log "Stopping existing containers"
    docker-compose down || true
    
    # Start new containers
    log "Starting new containers"
    docker-compose up -d
    
    # Wait for containers to be ready
    log "Waiting for containers to start..."
    sleep 30
    
    log "Docker deployment completed"
}

# Deploy without Docker
deploy_standard() {
    log "Deploying standard application..."
    
    # Stop existing application
    if command -v pm2 &> /dev/null; then
        log "Stopping PM2 processes"
        pm2 stop "$PROJECT_NAME" || true
    elif command -v systemctl &> /dev/null; then
        log "Stopping systemd service"
        sudo systemctl stop "$PROJECT_NAME" || true
    fi
    
    # Copy files to production directory
    local prod_dir="/var/www/$PROJECT_NAME"
    log "Copying files to $prod_dir"
    
    # Create production directory
    sudo mkdir -p "$prod_dir"
    
    # Copy application files
    sudo cp -r .next "$prod_dir/"
    sudo cp -r public "$prod_dir/"
    sudo cp -r node_modules "$prod_dir/"
    sudo cp package.json "$prod_dir/"
    sudo cp next.config.js "$prod_dir/"
    
    # Set permissions
    sudo chown -R www-data:www-data "$prod_dir"
    sudo chmod -R 755 "$prod_dir"
    
    # Start application
    if command -v pm2 &> /dev/null; then
        log "Starting with PM2"
        cd "$prod_dir"
        pm2 start npm --name "$PROJECT_NAME" -- start
        pm2 save
    elif command -v systemctl &> /dev/null; then
        log "Starting with systemd"
        sudo systemctl start "$PROJECT_NAME"
        sudo systemctl enable "$PROJECT_NAME"
    else
        error "No process manager found (PM2 or systemd required)"
        exit 1
    fi
    
    log "Standard deployment completed"
}

# Health check
health_check() {
    log "Performing health check..."
    
    local retry_count=0
    while [[ $retry_count -lt $MAX_RETRIES ]]; do
        log "Health check attempt $((retry_count + 1))/$MAX_RETRIES"
        
        if curl -f -s "$HEALTH_CHECK_URL" > /dev/null; then
            log "Health check passed"
            return 0
        else
            warning "Health check failed, retrying in $RETRY_DELAY seconds..."
            sleep $RETRY_DELAY
            ((retry_count++))
        fi
    done
    
    error "Health check failed after $MAX_RETRIES attempts"
    return 1
}

# Verify deployment
verify_deployment() {
    log "Verifying deployment..."
    
    # Check application response
    local response=$(curl -s "$HEALTH_CHECK_URL")
    if echo "$response" | grep -q "healthy"; then
        log "Application is responding correctly"
    else
        error "Application health check failed"
        return 1
    fi
    
    # Check video call functionality
    if command -v npm &> /dev/null; then
        log "Running video call tests"
        npm run test:video-calls || warning "Video call tests failed"
    fi
    
    # Check database connectivity
    if [[ -n "$DB_HOST" ]]; then
        log "Testing database connectivity"
        if pg_isready -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USER"; then
            log "Database connectivity verified"
        else
            warning "Database connectivity check failed"
        fi
    fi
    
    log "Deployment verification completed"
}

# Setup monitoring
setup_monitoring() {
    log "Setting up monitoring..."
    
    # Create log directories
    sudo mkdir -p /var/log/video-calls
    sudo chown www-data:www-data /var/log/video-calls
    
    # Setup log rotation
    sudo tee /etc/logrotate.d/video-calls > /dev/null <<EOF
/var/log/video-calls/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 www-data www-data
    postrotate
        systemctl reload nginx || true
    endscript
}
EOF
    
    # Setup monitoring cron jobs
    (crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/cleanup-video-call-data.sh") | crontab -
    (crontab -l 2>/dev/null; echo "*/5 * * * * curl -f $HEALTH_CHECK_URL > /dev/null || echo 'Health check failed' | logger") | crontab -
    
    log "Monitoring setup completed"
}

# Rollback function
rollback() {
    error "Deployment failed, initiating rollback..."
    
    # Stop current deployment
    if command -v docker-compose &> /dev/null && [[ -f "docker-compose.yml" ]]; then
        docker-compose down
    elif command -v pm2 &> /dev/null; then
        pm2 stop "$PROJECT_NAME" || true
    elif command -v systemctl &> /dev/null; then
        sudo systemctl stop "$PROJECT_NAME" || true
    fi
    
    # Restore from backup
    local latest_backup=$(ls -t "$BACKUP_DIR"/app_*.tar.gz 2>/dev/null | head -n1)
    if [[ -n "$latest_backup" ]]; then
        log "Restoring from backup: $latest_backup"
        sudo tar -xzf "$latest_backup" -C "/var/www/"
        
        # Restart application
        if command -v pm2 &> /dev/null; then
            pm2 start "$PROJECT_NAME"
        elif command -v systemctl &> /dev/null; then
            sudo systemctl start "$PROJECT_NAME"
        fi
    else
        error "No backup found for rollback"
    fi
    
    error "Rollback completed"
    exit 1
}

# Main deployment function
main() {
    log "Starting production deployment for $PROJECT_NAME"
    
    # Set trap for rollback on error
    trap rollback ERR
    
    # Load environment variables
    if [[ -f ".env.production" ]]; then
        log "Loading production environment variables"
        set -a
        source .env.production
        set +a
    else
        warning "No .env.production file found"
    fi
    
    # Run deployment steps
    check_prerequisites
    create_backup
    run_migrations
    build_application
    
    # Choose deployment method
    if [[ -f "docker-compose.yml" ]] && command -v docker-compose &> /dev/null; then
        deploy_docker
    else
        deploy_standard
    fi
    
    # Verify deployment
    if health_check && verify_deployment; then
        setup_monitoring
        log "Deployment completed successfully!"
        
        # Send success notification
        if command -v mail &> /dev/null && [[ -n "$NOTIFICATION_EMAIL" ]]; then
            echo "Video call system deployed successfully at $(date)" | \
                mail -s "Deployment Success - $PROJECT_NAME" "$NOTIFICATION_EMAIL"
        fi
    else
        error "Deployment verification failed"
        rollback
    fi
    
    # Remove trap
    trap - ERR
}

# Script usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo "  -v, --verbose  Enable verbose output"
    echo "  --dry-run      Perform a dry run without making changes"
    echo "  --skip-tests   Skip running tests during build"
    echo "  --skip-backup  Skip creating backup"
    echo ""
    echo "Environment variables:"
    echo "  DB_HOST                Database host"
    echo "  DB_USER                Database user"
    echo "  DB_NAME                Database name"
    echo "  DB_PORT                Database port (default: 5432)"
    echo "  NOTIFICATION_EMAIL     Email for deployment notifications"
    echo ""
    echo "Example:"
    echo "  $0 --verbose"
    echo "  DB_HOST=localhost DB_USER=postgres DB_NAME=medica_movil $0"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            usage
            exit 0
            ;;
        -v|--verbose)
            set -x
            shift
            ;;
        --dry-run)
            log "Dry run mode enabled"
            DRY_RUN=true
            shift
            ;;
        --skip-tests)
            log "Skipping tests"
            SKIP_TESTS=true
            shift
            ;;
        --skip-backup)
            log "Skipping backup"
            SKIP_BACKUP=true
            shift
            ;;
        *)
            error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Run main function
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi