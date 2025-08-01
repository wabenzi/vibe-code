#!/bin/bash

# Check LocalStack Status Script
# Verifies if LocalStack is running and ready for integration tests

set -e

# Source common logging functions
# shellcheck disable=SC2034
export LOG_PREFIX="CHECK"
# shellcheck disable=SC1091
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$(dirname "${SCRIPT_DIR}")")"
# shellcheck source=scripts/utils/common-logging.sh
source "${PROJECT_DIR}/scripts/utils/common-logging.sh"

LOCALSTACK_URL="http://localhost:4566"
TIMEOUT=10

log_info "Checking LocalStack status..."

# Function to check LocalStack health
check_localstack() {
    if curl -s --max-time $TIMEOUT "$LOCALSTACK_URL/_localstack/health" > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Check if LocalStack is running
if check_localstack; then
    log_success "LocalStack is running and healthy"
    log_info "Health endpoint: $LOCALSTACK_URL/_localstack/health"
    
    # Check if API Gateway is deployed
    if curl -s --max-time $TIMEOUT "$LOCALSTACK_URL/_localstack/health" | grep -q "apigateway.*running"; then
        log_success "API Gateway service is running"
    else
        log_warning "API Gateway may not be fully deployed"
    fi
    
    log_separator
    log_success "Ready to run integration tests:"
    log_info "   npm run test:integration"
    
    exit 0
else
    log_error "LocalStack is not running or not healthy"
    log_separator
    log_info "To start LocalStack and deploy infrastructure:"
    log_info "   npm run deploy:localstack"
    log_separator
    log_info "For more information, see docs/TESTING_QUICK_START.md"
    
    exit 1
fi
