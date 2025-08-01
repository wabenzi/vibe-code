#!/bin/bash 

# Script Validation Test - Comprehensive testing for all bash scripts
# This script validates syntax and runs shellcheck against all scripts in the project
#
# Usage:
#   ./scripts/validate-scripts.sh [--verbose] [--fix-permissions]
#
# Options:
#   --verbose         Show detailed output for each test
#   --fix-permissions Automatically fix script permissions (chmod +x)

set -e

# Source common logging functions
SCRIPT_DIR="$(dirname "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)")"
# shellcheck source=scripts/utils/common-logging.sh
source "${SCRIPT_DIR}/utils/common-logging.sh"


# Configuration
VERBOSE=false
FIX_PERMISSIONS=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --verbose)
            VERBOSE=true
            shift
            ;;
        --fix-permissions)
            FIX_PERMISSIONS=true
            shift
            ;;
        --debug)
            # shellcheck disable=SC2034
            DEBUG=true
            shift
            ;;
        --help|-h)
            # Show help and exit
            cat << 'EOF'
Script Validation Test Suite

Usage: $0 [--verbose] [--fix-permissions]

Options:
  --verbose         Show detailed output for each test
  --fix-permissions Automatically fix script permissions (chmod +x)
  --debug           Enable debug output
  --help, -h        Show this help message

This script will:
  1. Check execute permissions on all .sh files
  2. Validate bash syntax using 'bash -n'
  3. Run shellcheck analysis (if available)
  4. Provide a comprehensive validation report
EOF
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Track results
declare -a PASSED_SCRIPTS=()
declare -a FAILED_SCRIPTS=()
declare -a SHELLCHECK_WARNINGS=()
declare -a PERMISSION_FIXED=()

# Check if shellcheck is available
check_shellcheck() {
    if ! command -v shellcheck &> /dev/null; then
        log_warning "shellcheck is not installed. Install it with:"
        log_info "  macOS: brew install shellcheck"
        log_info "  Ubuntu: apt-get install shellcheck"
        log_info "  Other: https://github.com/koalaman/shellcheck#installing"
        return 1
    fi
    return 0
}

# Get all bash scripts in the scripts directory
get_scripts() {
  find "${SCRIPT_DIR}" -name "*.sh" -type f \
    -not -path "*/docs/generated/*" \
    -not -path "*/clients/*" \
    -not -path "*/coverage/*" \
    -not -path "*/cdk.out/*" \
    -not -path "*/node_modules/*" \
    | sort
}

# Check if script has execute permissions
check_permissions() {
    local script="$1"
    if [[ ! -x "${script}" ]]; then
        if [[ "${FIX_PERMISSIONS}" == "true" ]]; then
            chmod +x "${script}"
            PERMISSION_FIXED+=("$(basename "${script}")")
            log_info "Fixed permissions for $(basename "${script}")"
        else
            log_warning "$(basename "${script}") is not executable (use --fix-permissions to fix)"
        fi
    fi
}

# Test bash syntax for a script
test_syntax() {
    local script="$1"
    local script_name
    script_name="$(basename "${script}")"
    
    if [[ "${VERBOSE}" == "true" ]]; then
        log_info "Testing syntax: ${script_name}"
    fi
    
    if bash -n "${script}" 2>/dev/null; then
        PASSED_SCRIPTS+=("${script_name}")
        if [[ "${VERBOSE}" == "true" ]]; then
            log_success "✅ ${script_name} syntax OK"
        fi
        return 0
    else
        FAILED_SCRIPTS+=("${script_name}")
        log_error "❌ ${script_name} syntax FAILED"
        # Show the actual error
        log_error "Syntax error details:"
        while IFS= read -r line; do
            echo "    ${line}"
        done < <(bash -n "${script}" 2>&1)
        return 1
    fi
}

# Run shellcheck on a script
test_shellcheck() {
    local script="$1"
    local script_name
    script_name="$(basename "${script}")"
    
    if [[ "${VERBOSE}" == "true" ]]; then
        log_info "Running shellcheck: ${script_name}"
    fi
    
    local shellcheck_output
    shellcheck_output=$(shellcheck "${script}" 2>&1) || true
    
    if [[ -z "${shellcheck_output}" ]]; then
        if [[ "${VERBOSE}" == "true" ]]; then
            log_success "✅ ${script_name} shellcheck clean"
        fi
        return 0
    else
        SHELLCHECK_WARNINGS+=("${script_name}")
        log_warning "⚠️  ${script_name} has shellcheck issues:"
        # Indent each line of shellcheck output
        while IFS= read -r line; do
            echo "    ${line}"
        done <<< "${shellcheck_output}"
        echo ""
        return 1
    fi
}

# Main validation function
main() {
    log_header "Script Validation Test Suite"
    log_debug "Script directory: ${SCRIPT_DIR}"
    log_debug "Scripts: $(get_scripts)"

    local scripts=()
    local script
    while IFS= read -r script; do
        scripts+=("${script}")
    done < <(get_scripts) || true
    
    if [[ ${#scripts[@]} -eq 0 ]]; then
        log_error "No bash scripts found in ${SCRIPT_DIR}"
        exit 1
    fi
    
    log_info "Found ${#scripts[@]} bash scripts to validate"
    
    # Check shellcheck availability
    local has_shellcheck=true
    if ! check_shellcheck; then
        has_shellcheck=false
    fi
    
    log_separator
    log_section "Phase 1: Permission Check"
    
    for script in "${scripts[@]}"; do
        check_permissions "${script}"
    done
    
    if [[ ${#PERMISSION_FIXED[@]} -gt 0 ]]; then
        log_info "Fixed permissions for: ${PERMISSION_FIXED[*]}"
    fi
    
    log_separator
    log_section "Phase 2: Syntax Validation"
    
    local syntax_failed=0
    for script in "${scripts[@]}"; do
        if ! test_syntax "${script}"; then
            ((syntax_failed++))
        fi
    done
    
    if [[ "${has_shellcheck}" == "true" ]]; then
        log_separator
        log_section "Phase 3: Shellcheck Analysis"
        
        local shellcheck_issues=0
        for script in "${scripts[@]}"; do
            if ! test_shellcheck "${script}"; then
                ((shellcheck_issues++))
            fi
        done
    fi
    
    # Summary report
    log_separator
    log_section "Validation Summary"
    
    log_info "Total scripts tested: ${#scripts[@]}"
    log_success "Syntax passed: ${#PASSED_SCRIPTS[@]}"
    
    if [[ ${#FAILED_SCRIPTS[@]} -gt 0 ]]; then
        log_error "Syntax failed: ${#FAILED_SCRIPTS[@]} (${FAILED_SCRIPTS[*]})"
    fi
    
    if [[ "${has_shellcheck}" == "true" ]]; then
        if [[ ${#SHELLCHECK_WARNINGS[@]} -gt 0 ]]; then
            log_warning "Shellcheck issues: ${#SHELLCHECK_WARNINGS[@]} (${SHELLCHECK_WARNINGS[*]})"
        else
            log_success "All scripts pass shellcheck"
        fi
    fi
    
    if [[ ${#PERMISSION_FIXED[@]} -gt 0 ]]; then
        log_info "Permissions fixed: ${#PERMISSION_FIXED[@]}"
    fi
    
    # Exit with error if any tests failed
    if [[ ${#FAILED_SCRIPTS[@]} -gt 0 ]]; then
        log_footer "❌ Validation FAILED - Fix syntax errors above"
        exit 1
    elif [[ "${has_shellcheck}" == "true" ]] && [[ ${#SHELLCHECK_WARNINGS[@]} -gt 0 ]]; then
        log_footer "⚠️  Validation completed with warnings - Consider fixing shellcheck issues"
        exit 0
    else
        log_footer "✅ All scripts validated successfully!"
        exit 0
    fi
}

# Run main function
main "$@"
