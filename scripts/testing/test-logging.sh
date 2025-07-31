#!/bin/bash

# Test script for common logging library
# Demonstrates all logging functions and features

# Source common logging functions
local SCRIPT_DIR="$(dirname "$(dirname "${BASH_SOURCE[0]}")")/common-logging.sh"
source ${SCRIPT_DIR}

echo "Testing Common Logging Library"
echo "=============================="
echo

# Test basic logging functions
log_info "This is an info message with default prefix"
log_success "This is a success message"
log_warning "This is a warning message"
log_error "This is an error message"
log_section "This is a section header"
echo

# Test debug logging (should not show by default)
log_debug "This debug message should not appear (DEBUG not set)"

# Test debug logging with DEBUG enabled
DEBUG=true log_debug "This debug message should appear (DEBUG=true)"
echo

# Test utility functions
log_separator
log_header "Testing Header Function"
log_info "Content inside header section"
log_footer "Testing Footer Function"
echo

# Test custom prefix
echo "Testing custom LOG_PREFIX:"
LOG_PREFIX="CUSTOM" source ${SCRIPT_DIR}
log_info "This message has a custom prefix"
echo

# Test AWS prefix
LOG_PREFIX="AWS" source ${SCRIPT_DIR}
log_info "This simulates AWS deployment logging"
log_success "AWS operation completed"
echo

# Test LocalStack prefix
LOG_PREFIX="LOCALSTACK" source ${SCRIPT_DIR}
log_info "This simulates LocalStack deployment logging"
log_success "LocalStack operation completed"
echo

# Demonstrate practical usage patterns
log_header "Practical Usage Example"
log_info "Starting deployment process..."
log_info "Checking dependencies..."
log_success "Dependencies verified"
log_warning "Legacy configuration detected"
log_info "Proceeding with deployment..."
log_success "Deployment completed successfully"
log_footer "All operations completed successfully!"

echo
echo "Common Logging Library Test Complete"
echo "====================================="
