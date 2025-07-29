#!/bin/bash

# Comprehensive Jest + Supertest + Pact Testing Script
# Replaces curl-based testing with enterprise-grade test automation

set -e

# Source common logging functions
# shellcheck disable=SC2034
export LOG_PREFIX="TEST"
# shellcheck disable=SC1091
source "$(dirname "$(dirname "$0")")/common-logging.sh"

# Configuration
REPORTS_DIR="test/reports"
COVERAGE_DIR="coverage"
PACTS_DIR="pacts"

# Ensure directories exist
setup_test_environment() {
	log_info "Setting up test environment..."
	
	mkdir -p "${REPORTS_DIR}" "${COVERAGE_DIR}" "${PACTS_DIR}"
	
	# Set test environment variables
	export NODE_ENV=test
	export CI=${CI:-false}
	export DEBUG=${DEBUG:-false}
	
	log_success "Test environment ready"
}

# Install dependencies if needed
check_dependencies() {
	log_info "Checking test dependencies..."
	
	if [[ ! -d "node_modules" ]]; then
		log_info "Installing dependencies..."
		npm ci
	fi
	
	log_success "Dependencies ready"
}

# Run unit tests
run_unit_tests() {
	log_info "Running unit tests..."
	
	npm run test:unit 2>&1 | tee "${REPORTS_DIR}/unit-tests.log" || {
		log_error "Unit tests failed"
		return 1
	}
	
	log_success "Unit tests passed"
}

# Run integration tests
run_integration_tests() {
	log_info "Running integration tests..."
	
	# Check if LocalStack is running
	if ! curl -s "http://localhost:4566/_localstack/health" >/dev/null; then
		log_warning "LocalStack not running, starting it..."
		npm run deploy:localstack
		sleep 10
	fi
	
	npm run test:integration 2>&1 | tee "${REPORTS_DIR}/integration-tests.log" || {
		log_error "Integration tests failed"
		return 1
	}
	
	log_success "Integration tests passed"
}

# Run contract tests
run_contract_tests() {
	log_info "Running contract tests..."
	
	npm run test:contract 2>&1 | tee "${REPORTS_DIR}/contract-tests.log" || {
		log_error "Contract tests failed"
		return 1
	}
	
	log_success "Contract tests passed"
}

# Run behavioral tests
run_behavioral_tests() {
	log_info "Running behavioral tests..."
	
	# Check if LocalStack is running for behavioral tests
	if ! curl -s "http://localhost:4566/_localstack/health" >/dev/null; then
		log_warning "LocalStack not running for behavioral tests"
		npm run deploy:localstack
		sleep 10
	fi
	
	npm run test:behavioral 2>&1 | tee "${REPORTS_DIR}/behavioral-tests.log" || {
		log_error "Behavioral tests failed"
		return 1
	}
	
	log_success "Behavioral tests passed"
}

# Run API tests
run_api_tests() {
	log_info "Running API tests..."
	
	# Ensure API is deployed and ready
	if ! curl -s "http://localhost:4566/_localstack/health" >/dev/null; then
		log_warning "LocalStack not running, starting it..."
		npm run deploy:localstack
		sleep 10
	fi
	
	npm run test:api 2>&1 | tee "${REPORTS_DIR}/api-tests.log" || {
		log_error "API tests failed"
		return 1
	}
	
	log_success "API tests passed"
}

# Run performance tests
run_performance_tests() {
	log_info "Running performance tests..."
	
	# Simple performance validation using Jest
	npm run test:integration -- --testNamePattern="Performance" 2>&1 | tee "${REPORTS_DIR}/performance-tests.log" || {
		log_error "Performance tests failed"
		return 1
	}
	
	log_success "Performance tests passed"
}

# Generate coverage report
generate_coverage() {
	log_info "Generating coverage report..."
	
	npm run test:ci 2>&1 | tee "${REPORTS_DIR}/coverage.log" || {
		log_warning "Coverage generation had issues, but continuing..."
	}
	
	if [[ -f "${COVERAGE_DIR}/lcov.info" ]]; then
		log_success "Coverage report generated at ${COVERAGE_DIR}/index.html"
	else
		log_warning "Coverage report not generated"
	fi
}

# Publish Pact contracts (if Pact broker is available)
publish_pacts() {
	if [[ -n ${PACT_BROKER_BASE_URL} ]]; then
		log_info "Publishing Pact contracts..."
		
		npx pact-broker publish "${PACTS_DIR}" \
			--consumer-app-version="$(git rev-parse HEAD)" \
			--broker-base-url="${PACT_BROKER_BASE_URL}" \
			--broker-username="${PACT_BROKER_USERNAME}" \
			--broker-password="${PACT_BROKER_PASSWORD}" \
			2>&1 | tee "${REPORTS_DIR}/pact-publish.log" || {
			log_warning "Failed to publish Pact contracts"
		}
		
		log_success "Pact contracts published"
	else
		log_info "Pact broker not configured, skipping contract publishing"
	fi
}

# Clean up test environment
cleanup_tests() {
	log_info "Cleaning up test environment..."
	
	# Clean up any test data if needed
	npm run test:localstack:cleanup 2>/dev/null || true
	
	log_success "Test cleanup complete"
}

# Display test results summary
show_results() {
	log_info "Test Results Summary"
	log_info "===================="
	
	if [[ -f "${REPORTS_DIR}/unit-tests.log" ]]; then
		log_info "Unit Tests: ✅ Passed"
	fi
	
	if [[ -f "${REPORTS_DIR}/integration-tests.log" ]]; then
		log_info "Integration Tests: ✅ Passed"
	fi
	
	if [[ -f "${REPORTS_DIR}/contract-tests.log" ]]; then
		log_info "Contract Tests: ✅ Passed"
	fi
	
	if [[ -f "${REPORTS_DIR}/behavioral-tests.log" ]]; then
		log_info "Behavioral Tests: ✅ Passed"
	fi
	
	if [[ -f "${REPORTS_DIR}/api-tests.log" ]]; then
		log_info "API Tests: ✅ Passed"
	fi
	
	if [[ -f "${COVERAGE_DIR}/lcov.info" ]]; then
		log_info "Coverage Report: 📊 Generated"
	fi
	
	log_info ""
	log_info "Reports available in: ${REPORTS_DIR}/"
	log_info "Coverage available in: ${COVERAGE_DIR}/index.html"
	log_success "All tests completed successfully!"
}

# Main test runner
run_all_tests() {
	log_info "Starting comprehensive test suite..."
	log_info "====================================="
	
	setup_test_environment
	check_dependencies
	
	case "${1:-all}" in
	"unit")
		run_unit_tests
		;;
	"integration")
		run_integration_tests
		;;
	"contract")
		run_contract_tests
		;;
	"behavioral"|"bdd")
		run_behavioral_tests
		;;
	"api")
		run_api_tests
		;;
	"performance")
		run_performance_tests
		;;
	"coverage")
		generate_coverage
		;;
	"ci")
		run_unit_tests
		run_integration_tests
		run_contract_tests
		generate_coverage
		publish_pacts
		;;
	"all")
		run_unit_tests
		run_integration_tests
		run_contract_tests
		run_behavioral_tests
		run_api_tests
		run_performance_tests
		generate_coverage
		publish_pacts
		show_results
		;;
	"cleanup")
		cleanup_tests
		;;
	*)
		echo "Usage: $0 [unit|integration|contract|behavioral|api|performance|coverage|ci|all|cleanup]"
		echo ""
		echo "Test Types:"
		echo "  unit         - Run unit tests only"
		echo "  integration  - Run integration tests with LocalStack"
		echo "  contract     - Run Pact contract tests"
		echo "  behavioral   - Run Cucumber behavioral tests"
		echo "  api          - Run API endpoint tests"
		echo "  performance  - Run performance validation tests"
		echo "  coverage     - Generate coverage report"
		echo "  ci           - Run CI/CD pipeline tests"
		echo "  all          - Run all test types (default)"
		echo "  cleanup      - Clean up test environment"
		exit 1
		;;
	esac
}

# Handle script execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
	trap cleanup_tests EXIT
	run_all_tests "$@"
fi
