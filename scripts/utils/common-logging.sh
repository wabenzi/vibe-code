#!/bin/bash

# Common Logging Library for AWS Serverless Project Scripts
# Source this file in your scripts to use consistent logging functions
#
# Usage:
#   source "${BASH_SOURCE[0]}/common-logging.sh"
#   log_info "Your message here"
#   log_success "Operation completed"
#   log_warning "Warning message"
#   log_error "Error message"
#   log_section "Section header"
#
# Advanced Usage:
#   # Custom prefix for script-specific logging
#   LOG_PREFIX="AWS" source "${BASH_SOURCE[0]}/common-logging.sh"
#   log_info "This will show [AWS] prefix"
#
#   # Debug logging (only shows when DEBUG=true)
#   DEBUG=true log_debug "Debug information"
#
#   # Utility functions for structured output
#   log_header "Main Section Title"
#   log_info "Content goes here"
#   log_footer "Section completed successfully"
#
# Available Functions:
#   log_info()      - Blue [INFO] or [custom] messages
#   log_success()   - Green [SUCCESS] messages
#   log_warning()   - Yellow [WARNING] messages
#   log_error()     - Red [ERROR] messages
#   log_section()   - Purple [SECTION] headers
#   log_debug()     - Cyan [DEBUG] messages (only when DEBUG=true)
#   log_separator() - Prints a separator line
#   log_header()    - Section header with separators
#   log_footer()    - Section footer with separators
#
# Test the library:
#   ./scripts/test-logging.sh

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Default prefix - can be overridden by setting LOG_PREFIX before sourcing
: "${LOG_PREFIX:=INFO}"

# Core logging functions
log_info() {
	echo -e "${BLUE}[${LOG_PREFIX}]${NC} $1"
}

log_success() {
	echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
	echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
	echo -e "${RED}[ERROR]${NC} $1"
}

log_section() {
	echo -e "${PURPLE}[SECTION]${NC} $1"
}

log_debug() {
	if [[ "${DEBUG:-}" == "true" ]]; then
		echo -e "${CYAN}[DEBUG]${NC} $1"
	fi
}

# Additional utility functions for common patterns
log_separator() {
	echo "======================================="
}

log_header() {
	log_separator
	log_section "$1"
	log_separator
}

log_footer() {
	log_separator
	log_success "$1"
	log_separator
}
