#!/bin/bash

# Cleanup script for video call monitoring data
# This script removes old monitoring data to prevent database bloat

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="/var/log/video-call-cleanup.log"
DRY_RUN=false
VERBOSE=false

# Default retention periods (in days)
QUALITY_METRICS_RETENTION=30
USAGE_ANALYTICS_RETENTION=90
ERROR_EVENTS_RETENTION=60
CALL_RECORDS_RETENTION=365
SIGNAL_RECORDS_RETENTION=7

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() {
    local message="[$(date +'%Y-%m-%d %H:%M:%S')] $1"
    echo -e "${GREEN}${message}${NC}"
    echo "$message" >> "$LOG_FILE"
}

error() {
    local message="[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1"
    echo -e "${RED}${message}${NC}" >&2
    echo "$message" >> "$LOG_FILE"
}

warning() {
    local message="[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1"
    echo -e "${YELLOW}${message}${NC}"
    echo "$message" >> "$LOG_FILE"
}

info() {
    local message="[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1"
    if [[ "$VERBOSE" == "true" ]]; then
        echo -e "${BLUE}${message}${NC}"
    fi
    echo "$message" >> "$LOG_FILE"
}

# Check database connection
check_database_connection() {
    log "Checking database connection..."
    
    if [[ -z "$DATABASE_URL" ]]; then
        error "DATABASE_URL environment variable not set"
        exit 1
    fi
    
    # Test connection
    if ! psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
        error "Cannot connect to database"
        exit 1
    fi
    
    log "Database connection successful"
}

# Get table statistics
get_table_stats() {
    local table_name="$1"
    
    local total_rows=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM $table_name;" | tr -d ' ')
    local table_size=$(psql "$DATABASE_URL" -t -c "SELECT pg_size_pretty(pg_total_relation_size('$table_name'));" | tr -d ' ')
    
    info "Table $table_name: $total_rows rows, $table_size"
}

# Clean up quality metrics
cleanup_quality_metrics() {
    log "Cleaning up video call quality metrics older than $QUALITY_METRICS_RETENTION days..."
    
    get_table_stats "video_call_quality_metrics"
    
    local cutoff_date=$(date -d "$QUALITY_METRICS_RETENTION days ago" '+%Y-%m-%d')
    local query="DELETE FROM video_call_quality_metrics WHERE created_at < '$cutoff_date';"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        local count=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM video_call_quality_metrics WHERE created_at < '$cutoff_date';" | tr -d ' ')
        info "DRY RUN: Would delete $count quality metrics records"
    else
        local deleted=$(psql "$DATABASE_URL" -t -c "$query SELECT ROW_COUNT();" | tail -n 1 | tr -d ' ')
        log "Deleted $deleted quality metrics records"
    fi
}

# Clean up usage analytics
cleanup_usage_analytics() {
    log "Cleaning up video call usage analytics older than $USAGE_ANALYTICS_RETENTION days..."
    
    get_table_stats "video_call_usage_analytics"
    
    local cutoff_date=$(date -d "$USAGE_ANALYTICS_RETENTION days ago" '+%Y-%m-%d')
    local query="DELETE FROM video_call_usage_analytics WHERE created_at < '$cutoff_date';"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        local count=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM video_call_usage_analytics WHERE created_at < '$cutoff_date';" | tr -d ' ')
        info "DRY RUN: Would delete $count usage analytics records"
    else
        local deleted=$(psql "$DATABASE_URL" -t -c "$query SELECT ROW_COUNT();" | tail -n 1 | tr -d ' ')
        log "Deleted $deleted usage analytics records"
    fi
}

# Clean up error events
cleanup_error_events() {
    log "Cleaning up video call error events older than $ERROR_EVENTS_RETENTION days..."
    
    get_table_stats "video_call_error_events"
    
    local cutoff_date=$(date -d "$ERROR_EVENTS_RETENTION days ago" '+%Y-%m-%d')
    local query="DELETE FROM video_call_error_events WHERE created_at < '$cutoff_date';"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        local count=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM video_call_error_events WHERE created_at < '$cutoff_date';" | tr -d ' ')
        info "DRY RUN: Would delete $count error event records"
    else
        local deleted=$(psql "$DATABASE_URL" -t -c "$query SELECT ROW_COUNT();" | tail -n 1 | tr -d ' ')
        log "Deleted $deleted error event records"
    fi
}

# Clean up old call records
cleanup_call_records() {
    log "Cleaning up video call records older than $CALL_RECORDS_RETENTION days..."
    
    get_table_stats "video_calls"
    
    local cutoff_date=$(date -d "$CALL_RECORDS_RETENTION days ago" '+%Y-%m-%d')
    local query="DELETE FROM video_calls WHERE created_at < '$cutoff_date' AND status IN ('ended', 'declined', 'failed');"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        local count=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM video_calls WHERE created_at < '$cutoff_date' AND status IN ('ended', 'declined', 'failed');" | tr -d ' ')
        info "DRY RUN: Would delete $count call records"
    else
        local deleted=$(psql "$DATABASE_URL" -t -c "$query SELECT ROW_COUNT();" | tail -n 1 | tr -d ' ')
        log "Deleted $deleted call records"
    fi
}

# Clean up signal records
cleanup_signal_records() {
    log "Cleaning up WebRTC signal records older than $SIGNAL_RECORDS_RETENTION days..."
    
    get_table_stats "webrtc_signals"
    
    local cutoff_date=$(date -d "$SIGNAL_RECORDS_RETENTION days ago" '+%Y-%m-%d')
    local query="DELETE FROM webrtc_signals WHERE created_at < '$cutoff_date';"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        local count=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM webrtc_signals WHERE created_at < '$cutoff_date';" | tr -d ' ')
        info "DRY RUN: Would delete $count signal records"
    else
        local deleted=$(psql "$DATABASE_URL" -t -c "$query SELECT ROW_COUNT();" | tail -n 1 | tr -d ' ')
        log "Deleted $deleted signal records"
    fi
}

# Vacuum and analyze tables
vacuum_tables() {
    if [[ "$DRY_RUN" == "true" ]]; then
        info "DRY RUN: Would vacuum and analyze tables"
        return
    fi
    
    log "Vacuuming and analyzing tables..."
    
    local tables=(
        "video_calls"
        "webrtc_signals"
        "video_call_quality_metrics"
        "video_call_usage_analytics"
        "video_call_error_events"
    )
    
    for table in "${tables[@]}"; do
        info "Vacuuming table: $table"
        psql "$DATABASE_URL" -c "VACUUM ANALYZE $table;" > /dev/null 2>&1
    done
    
    log "Vacuum and analyze completed"
}

# Generate cleanup report
generate_report() {
    log "Generating cleanup report..."
    
    local report_file="/tmp/video-call-cleanup-report-$(date +%Y%m%d_%H%M%S).txt"
    
    {
        echo "Video Call System Cleanup Report"
        echo "Generated: $(date)"
        echo "========================================"
        echo ""
        echo "Configuration:"
        echo "- Quality Metrics Retention: $QUALITY_METRICS_RETENTION days"
        echo "- Usage Analytics Retention: $USAGE_ANALYTICS_RETENTION days"
        echo "- Error Events Retention: $ERROR_EVENTS_RETENTION days"
        echo "- Call Records Retention: $CALL_RECORDS_RETENTION days"
        echo "- Signal Records Retention: $SIGNAL_RECORDS_RETENTION days"
        echo ""
        echo "Current Table Statistics:"
        
        for table in "video_calls" "webrtc_signals" "video_call_quality_metrics" "video_call_usage_analytics" "video_call_error_events"; do
            local rows=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM $table;" | tr -d ' ')
            local size=$(psql "$DATABASE_URL" -t -c "SELECT pg_size_pretty(pg_total_relation_size('$table'));" | tr -d ' ')
            echo "- $table: $rows rows, $size"
        done
        
        echo ""
        echo "Database Size:"
        local db_size=$(psql "$DATABASE_URL" -t -c "SELECT pg_size_pretty(pg_database_size(current_database()));" | tr -d ' ')
        echo "- Total Database Size: $db_size"
        
    } > "$report_file"
    
    log "Cleanup report generated: $report_file"
    
    # Email report if configured
    if [[ -n "$NOTIFICATION_EMAIL" ]] && command -v mail > /dev/null 2>&1; then
        mail -s "Video Call Cleanup Report - $(date +%Y-%m-%d)" "$NOTIFICATION_EMAIL" < "$report_file"
        log "Report emailed to $NOTIFICATION_EMAIL"
    fi
}

# Main cleanup function
main() {
    log "Starting video call monitoring data cleanup..."
    
    # Check prerequisites
    check_database_connection
    
    # Perform cleanup operations
    cleanup_quality_metrics
    cleanup_usage_analytics
    cleanup_error_events
    cleanup_call_records
    cleanup_signal_records
    
    # Optimize database
    vacuum_tables
    
    # Generate report
    generate_report
    
    log "Cleanup completed successfully"
}

# Script usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -h, --help                    Show this help message"
    echo "  -v, --verbose                 Enable verbose output"
    echo "  -n, --dry-run                 Perform a dry run without making changes"
    echo "  --quality-retention DAYS      Quality metrics retention period (default: $QUALITY_METRICS_RETENTION)"
    echo "  --analytics-retention DAYS    Usage analytics retention period (default: $USAGE_ANALYTICS_RETENTION)"
    echo "  --errors-retention DAYS       Error events retention period (default: $ERROR_EVENTS_RETENTION)"
    echo "  --calls-retention DAYS        Call records retention period (default: $CALL_RECORDS_RETENTION)"
    echo "  --signals-retention DAYS      Signal records retention period (default: $SIGNAL_RECORDS_RETENTION)"
    echo ""
    echo "Environment variables:"
    echo "  DATABASE_URL                  PostgreSQL connection string"
    echo "  NOTIFICATION_EMAIL            Email for cleanup reports"
    echo ""
    echo "Examples:"
    echo "  $0 --dry-run --verbose"
    echo "  $0 --quality-retention 14 --analytics-retention 60"
    echo "  DATABASE_URL=postgresql://user:pass@host/db $0"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            usage
            exit 0
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -n|--dry-run)
            DRY_RUN=true
            log "DRY RUN MODE ENABLED - No changes will be made"
            shift
            ;;
        --quality-retention)
            QUALITY_METRICS_RETENTION="$2"
            shift 2
            ;;
        --analytics-retention)
            USAGE_ANALYTICS_RETENTION="$2"
            shift 2
            ;;
        --errors-retention)
            ERROR_EVENTS_RETENTION="$2"
            shift 2
            ;;
        --calls-retention)
            CALL_RECORDS_RETENTION="$2"
            shift 2
            ;;
        --signals-retention)
            SIGNAL_RECORDS_RETENTION="$2"
            shift 2
            ;;
        *)
            error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Create log directory if it doesn't exist
mkdir -p "$(dirname "$LOG_FILE")"

# Run main function
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi