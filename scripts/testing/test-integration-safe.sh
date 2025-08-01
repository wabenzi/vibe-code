#!/bin/bash

# Pre-Integration Test Script
# Ensures LocalStack is ready before running integration tests
# This script also ensures the current build is deployed to LocalStack

set -e

# Source common logging functions
# shellcheck disable=SC2034
export LOG_PREFIX="INTEGRATION"
# shellcheck disable=SC1091
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$(dirname "${SCRIPT_DIR}")")"
# shellcheck source=scripts/utils/common-logging.sh
source "${PROJECT_DIR}/scripts/utils/common-logging.sh"

log_header "Preparing for Integration Tests"

# Build the project to ensure current code is tested
build_project() {
    log_info "Building project to ensure current code is tested..."
    cd "${PROJECT_DIR}"
    if npm run build; then
        log_success "Project built successfully"
    else
        log_error "Project build failed"
        exit 1
    fi
}

# Check if LocalStack is running and deploy if needed
ensure_localstack_ready() {
    log_info "Checking LocalStack status..."
    
    # Check if LocalStack is running using the existing check script
    if "${SCRIPT_DIR}/check-localstack.sh" > /dev/null 2>&1; then
        log_success "LocalStack is already running"
        
        # Force redeploy to ensure current build is deployed
        log_info "Redeploying current build to LocalStack..."
        cd "${PROJECT_DIR}"
        if npm run deploy:localstack; then
            log_success "Current build deployed to LocalStack"
        else
            log_error "Failed to deploy current build to LocalStack"
            exit 1
        fi
    else
        log_warning "LocalStack is not ready"
        log_info "Starting LocalStack and deploying infrastructure..."
        
        cd "${PROJECT_DIR}"
        if npm run deploy:localstack; then
            log_success "LocalStack started and infrastructure deployed"
        else
            log_error "Failed to start LocalStack"
            log_info "Please check Docker and try manually:"
            log_info "   docker compose up -d"
            log_info "   npm run deploy:localstack"
            exit 1
        fi
    fi
}

# Run integration tests
run_integration_tests() {
    log_info "Running integration tests..."
    cd "${PROJECT_DIR}"
    
    if npm run test:integration; then
        log_success "Integration tests completed successfully"
    else
        log_error "Integration tests failed"
        log_info "Check LocalStack logs: docker compose logs localstack"
        exit 1
    fi
}

# Main execution flow
main() {
    build_project
    ensure_localstack_ready
    run_integration_tests
    log_footer "Integration testing completed successfully"
}

# Execute main function
main "$@"
