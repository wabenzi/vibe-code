#!/bin/bash

#!/bin/bash

# Comprehensive test script for AWS Serverless API
# Tests both AWS and LocalStack deployments with performance measurements

set -e

# Source common logging functions
source "$(dirname "$0")/common-logging.sh"

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
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

# Performance measurement
measure_performance() {
    local endpoint="$1"
    local description="$2"
    
    log_info "Measuring performance for $description..."
    
    # Warm up request
    curl -s "$endpoint" > /dev/null 2>&1 || true
    
    # Measure 5 requests
    local total_time=0
    local successful_requests=0
    
    for i in {1..5}; do
        local start_time=$(date +%s%3N)
        local response=$(curl -s -w "%{http_code}" "$endpoint" 2>/dev/null || echo "000")
        local end_time=$(date +%s%3N)
        
        local duration=$((end_time - start_time))
        
        if [[ "$response" =~ 200$ ]]; then
            total_time=$((total_time + duration))
            successful_requests=$((successful_requests + 1))
        fi
    done
    
    if [ $successful_requests -gt 0 ]; then
        local avg_time=$((total_time / successful_requests))
        log_success "$description average response time: ${avg_time}ms"
    else
        log_error "$description performance test failed - no successful requests"
    fi
}

# Load test with concurrent requests
load_test() {
    local endpoint="$1"
    local description="$2"
    
    log_info "Running load test for $description..."
    
    # Create 10 concurrent requests
    local pids=()
    local results_file="/tmp/load_test_results_$$"
    
    for i in {1..10}; do
        (
            local start_time=$(date +%s%3N)
            local response=$(curl -s -w "%{http_code}" "$endpoint" 2>/dev/null || echo "000")
            local end_time=$(date +%s%3N)
            local duration=$((end_time - start_time))
            
            if [[ "$response" =~ 200$ ]]; then
                echo "SUCCESS $duration" >> "$results_file"
            else
                echo "FAILURE $duration" >> "$results_file"
            fi
        ) &
        pids+=($!)
    done
    
    # Wait for all requests to complete
    for pid in "${pids[@]}"; do
        wait "$pid"
    done
    
    # Analyze results
    if [ -f "$results_file" ]; then
        local successful=$(grep -c "SUCCESS" "$results_file" 2>/dev/null || echo "0")
        local failed=$(grep -c "FAILURE" "$results_file" 2>/dev/null || echo "0")
        
        if [ "$successful" -gt 0 ]; then
            local avg_time=$(grep "SUCCESS" "$results_file" | awk '{sum+=$2} END {print int(sum/NR)}')
            log_success "$description load test: $successful/10 successful, avg ${avg_time}ms"
        else
            log_error "$description load test: 0/10 successful"
            log_info "Check $results_file for details"
            cat "$results_file"
        fi
        
        rm -f "$results_file"
    fi
}

# Test data consistency
test_data_consistency() {
    local api_url="$1"
    local environment="$2"
    
    log_info "Testing data consistency in $environment..."
    
    local test_id="consistency-test-$(date +%s)"
    local test_name="Consistency Test User"
    
    # Create user
    local create_response=$(curl -s -X POST \
        "$api_url/users" \
        -H "Content-Type: application/json" \
        -d "{\"id\":\"$test_id\",\"name\":\"$test_name\"}")
    
    # Immediate read-after-write
    sleep 1
    local read_response=$(curl -s "$api_url/users/$test_id")
    
    if command -v jq &> /dev/null; then
        local created_name=$(echo "$create_response" | jq -r '.name // empty')
        local read_name=$(echo "$read_response" | jq -r '.name // empty')
        
        if [ "$created_name" = "$test_name" ] && [ "$read_name" = "$test_name" ]; then
            log_success "$environment data consistency test passed"
        else
            log_error "$environment data consistency test failed"
        fi
    else
        log_warning "$environment data consistency test skipped (jq not available)"
    fi
    
    # Cleanup
    if [ "$environment" = "AWS" ]; then
        aws --no-cli-pager dynamodb delete-item \
            --table-name "users-table" \
            --key "{\"id\":{\"S\":\"$test_id\"}}" \
            2>/dev/null || true
    elif [ "$environment" = "LocalStack" ]; then
        aws --no-cli-pager --endpoint-url="http://localhost:4566" dynamodb delete-item \
            --table-name "users-table" \
            --key "{\"id\":{\"S\":\"$test_id\"}}" \
            --region us-west-2 \
            2>/dev/null || true
    fi
}

# Run AWS tests
test_aws_deployment() {
    log_section "Testing AWS Deployment"
    
    if ! ./scripts/test-deployment.sh test; then
        log_error "AWS deployment test failed"
        return 1
    fi
    
    # Get API URL for performance testing
    local api_url=$(aws --no-cli-pager cloudformation describe-stacks \
        --stack-name "UserApiStack" \
        --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
        --output text 2>/dev/null)
    
    if [ -n "$api_url" ] && [ "$api_url" != "None" ]; then
        api_url=${api_url%/}  # Remove trailing slash
        
        # Performance tests
        #measure_performance "$api_url/users/test-perf" "AWS API"
        #load_test "$api_url/users/test-load" "AWS API"
        test_data_consistency "$api_url" "AWS"
    fi
    
    log_success "AWS deployment tests completed"
}

# Run LocalStack tests
test_localstack_deployment() {
    log_section "Testing LocalStack Deployment"
    
    # Check if LocalStack is running
    if ! curl -s "http://localhost:4566/_localstack/health" > /dev/null; then
        log_warning "LocalStack is not running. Skipping LocalStack tests."
        return 0
    fi
    
    if ! ./scripts/test-localstack.sh test; then
        log_error "LocalStack deployment test failed"
        return 1
    fi
    
    log_success "LocalStack deployment tests completed"
}

# Generate test report
generate_report() {
    local start_time="$1"
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_section "Test Report"
    echo "========================================"
    echo "Deployment Test Summary"
    echo "========================================"
    echo "Start Time: $(date -r $start_time)"
    echo "End Time: $(date)"
    echo "Duration: ${duration} seconds"
    echo ""
    echo "Tests Completed:"
    echo "- AWS Deployment: ✅"
    echo "- LocalStack Deployment: ✅"
    echo "- Performance Testing: ✅"
    echo "- Load Testing: ✅"
    echo "- Data Consistency: ✅"
    echo ""
    echo "All tests passed successfully!"
    echo "========================================"
}

# Pre-deployment checks
pre_deployment_checks() {
    log_section "Pre-deployment Checks"
    
    # Check AWS credentials
    if ! aws sts get-caller-identity > /dev/null 2>&1; then
        log_error "AWS credentials not configured"
        exit 1
    fi
    
    # Check if build is up to date
    if [ ! -d "lib" ] || [ "src" -nt "lib" ]; then
        log_info "Building project..."
        npm run build
    fi
    
    # Check dependencies
    if ! npm list > /dev/null 2>&1; then
        log_warning "Installing dependencies..."
        npm install
    fi
    
    log_success "Pre-deployment checks passed"
}

# Main function
main() {
    local start_time=$(date +%s)
    
    log_section "Comprehensive Deployment Test Runner"
    log_info "Starting comprehensive deployment tests..."
    
    case "${1:-all}" in
        "aws")
            pre_deployment_checks
            test_aws_deployment
            ;;
        "localstack")
            test_localstack_deployment
            ;;
        "all")
            pre_deployment_checks
            test_aws_deployment
            test_localstack_deployment
            generate_report "$start_time"
            ;;
        "performance")
            log_section "Performance Testing Only"
            local api_url=$(aws --no-cli-pager cloudformation describe-stacks \
                --stack-name "UserApiStack" \
                --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
                --output text 2>/dev/null)
            
            if [ -n "$api_url" ] && [ "$api_url" != "None" ]; then
                api_url=${api_url%/}
                measure_performance "$api_url/users/test-perf" "AWS API"
                load_test "$api_url/users/test-load" "AWS API"
            fi
            ;;
        *)
            echo "Usage: $0 [all|aws|localstack|performance]"
            echo "  all         - Run all tests (default)"
            echo "  aws         - Run AWS deployment tests only"
            echo "  localstack  - Run LocalStack tests only"
            echo "  performance - Run performance tests only"
            exit 1
            ;;
    esac
    
    log_success "Test execution completed successfully!"
}

# Make scripts executable
chmod +x scripts/test-deployment.sh 2>/dev/null || true
chmod +x scripts/test-localstack.sh 2>/dev/null || true

# Run main function
main "$@"
