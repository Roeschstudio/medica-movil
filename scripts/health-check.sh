#!/bin/sh

# Health check script for video call system
# This script performs comprehensive health checks

set -e

# Configuration
HEALTH_URL="http://localhost:3000/api/health"
TIMEOUT=10
MAX_RETRIES=3

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${GREEN}[HEALTH] $1${NC}"
}

error() {
    echo -e "${RED}[HEALTH] ERROR: $1${NC}"
}

warning() {
    echo -e "${YELLOW}[HEALTH] WARNING: $1${NC}"
}

# Check if application is responding
check_application() {
    log "Checking application health..."
    
    local retry_count=0
    while [ $retry_count -lt $MAX_RETRIES ]; do
        if curl -f -s --max-time $TIMEOUT "$HEALTH_URL" > /dev/null 2>&1; then
            log "Application is responding"
            return 0
        else
            retry_count=$((retry_count + 1))
            if [ $retry_count -lt $MAX_RETRIES ]; then
                warning "Application not responding, retry $retry_count/$MAX_RETRIES"
                sleep 2
            fi
        fi
    done
    
    error "Application is not responding after $MAX_RETRIES attempts"
    return 1
}

# Check application health endpoint
check_health_endpoint() {
    log "Checking health endpoint..."
    
    local response=$(curl -s --max-time $TIMEOUT "$HEALTH_URL" 2>/dev/null || echo "")
    
    if [ -z "$response" ]; then
        error "No response from health endpoint"
        return 1
    fi
    
    # Check if response contains "healthy"
    if echo "$response" | grep -q "healthy"; then
        log "Health endpoint reports healthy status"
        return 0
    else
        error "Health endpoint reports unhealthy status"
        echo "Response: $response"
        return 1
    fi
}

# Check memory usage
check_memory() {
    log "Checking memory usage..."
    
    # Get memory usage in MB
    local memory_usage=$(ps -o pid,vsz,rss,comm -p $$ | tail -n 1 | awk '{print $3/1024}')
    local memory_limit=1024  # 1GB limit
    
    if [ "$(echo "$memory_usage > $memory_limit" | bc 2>/dev/null || echo 0)" -eq 1 ]; then
        warning "High memory usage: ${memory_usage}MB (limit: ${memory_limit}MB)"
    else
        log "Memory usage is normal: ${memory_usage}MB"
    fi
}

# Check disk space
check_disk_space() {
    log "Checking disk space..."
    
    local disk_usage=$(df /app | tail -n 1 | awk '{print $5}' | sed 's/%//')
    local disk_limit=90
    
    if [ "$disk_usage" -gt "$disk_limit" ]; then
        warning "High disk usage: ${disk_usage}% (limit: ${disk_limit}%)"
    else
        log "Disk usage is normal: ${disk_usage}%"
    fi
}

# Check process status
check_process() {
    log "Checking process status..."
    
    # Check if Node.js process is running
    if pgrep -f "node.*server.js" > /dev/null; then
        log "Node.js process is running"
    else
        error "Node.js process is not running"
        return 1
    fi
    
    # Check process uptime
    local uptime=$(ps -o etime= -p $$ | tr -d ' ')
    log "Process uptime: $uptime"
}

# Check network connectivity
check_network() {
    log "Checking network connectivity..."
    
    # Check if port 3000 is listening
    if netstat -ln 2>/dev/null | grep -q ":3000 "; then
        log "Port 3000 is listening"
    else
        error "Port 3000 is not listening"
        return 1
    fi
}

# Check environment variables
check_environment() {
    log "Checking environment variables..."
    
    local required_vars="NODE_ENV NEXT_PUBLIC_SUPABASE_URL"
    local missing_vars=""
    
    for var in $required_vars; do
        if [ -z "$(eval echo \$$var)" ]; then
            missing_vars="$missing_vars $var"
        fi
    done
    
    if [ -n "$missing_vars" ]; then
        error "Missing environment variables:$missing_vars"
        return 1
    else
        log "All required environment variables are set"
    fi
}

# Check file permissions
check_permissions() {
    log "Checking file permissions..."
    
    # Check if we can write to logs directory
    if [ -w "/app/logs" ]; then
        log "Logs directory is writable"
    else
        warning "Logs directory is not writable"
    fi
    
    # Check if we can read configuration files
    if [ -r "/app/package.json" ]; then
        log "Configuration files are readable"
    else
        error "Cannot read configuration files"
        return 1
    fi
}

# Main health check function
main() {
    log "Starting comprehensive health check..."
    
    local exit_code=0
    
    # Run all health checks
    check_application || exit_code=1
    check_health_endpoint || exit_code=1
    check_memory
    check_disk_space
    check_process || exit_code=1
    check_network || exit_code=1
    check_environment || exit_code=1
    check_permissions
    
    if [ $exit_code -eq 0 ]; then
        log "All health checks passed"
    else
        error "Some health checks failed"
    fi
    
    return $exit_code
}

# Run health check if script is executed directly
if [ "${0##*/}" = "health-check.sh" ]; then
    main "$@"
fi