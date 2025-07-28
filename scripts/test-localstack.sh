#!/bin/bash

# LocalStack Deployment Test Script
# Tests LocalStack deployment with similar validation as AWS

set -e

# Source common logging functions
LOG_PREFIX="LOCALSTACK"
source "$(dirname "$0")/common-logging.sh"

# Configuration
TEST_USER_ID="test-user-localstack-$(date +%s)"
TEST_USER_NAME="Test User LocalStack"
LOCALSTACK_URL="http://localhost:4566"

# Check if LocalStack is running
check_localstack() {
    log_info "Checking LocalStack status..."

    if ! curl -s "$LOCALSTACK_URL/_localstack/health" > /dev/null; then
        log_error "LocalStack is not running or not accessible at $LOCALSTACK_URL"
        log_info "Start LocalStack with: npm run deploy:localstack"
        exit 1
    fi
    
    log_success "LocalStack is running"
}

# Get API Gateway URL from LocalStack
get_localstack_api_url() {
    log_info "Getting API Gateway URL from LocalStack..." >&2
    
    # Use the new API Gateway URL from us-west-2 deployment
    local api_url="https://pn2dbiwwdp.execute-api.localhost.localstack.cloud:4566/local"
    log_success "LocalStack API URL: $api_url" >&2
    echo "$api_url"
}

# Create test user via LocalStack API
create_test_user_localstack() {
    local api_url="$1"
    log_info "Creating test user via LocalStack API..."
    
    local response
    response=$(curl -v -s -k -w "\n%{http_code}" -X POST \
        "$api_url/users" \
        -H "Content-Type: application/json" \
        -d "{\"id\":\"$TEST_USER_ID\",\"name\":\"$TEST_USER_NAME\"}")
    
    local http_code
    local body
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        log_success "User created successfully in LocalStack"
        log_info "Response: $body"
    else
        log_error "Failed to create user in LocalStack. HTTP code: $http_code"
        log_error "Response: $body"
        return 1
    fi
}

# Retrieve test user via LocalStack API
get_test_user_localstack() {
    local api_url="$1"
    log_info "Retrieving test user via LocalStack API..."
    
    local response
    response=$(curl -s -k -w "\n%{http_code}" -X GET \
        "$api_url/users/$TEST_USER_ID")
    
    local http_code
    local body
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" = "200" ]; then
        log_success "User retrieved successfully from LocalStack"
        log_info "Response: $body"
    else
        log_error "Failed to retrieve user from LocalStack. HTTP code: $http_code"
        log_error "Response: $body"
        return 1
    fi
}

# Verify DynamoDB persistence in LocalStack
verify_localstack_dynamo() {
    log_info "Verifying DynamoDB persistence in LocalStack..."
    
    # Set environment variables for AWS CLI to access LocalStack
    export AWS_ACCESS_KEY_ID=test
    export AWS_SECRET_ACCESS_KEY=test
    export AWS_DEFAULT_REGION=us-east-1
    
    # Note: DynamoDB table appears to be created in us-east-1 regardless of CDK config
    local item
    item=$(aws --no-cli-pager --endpoint-url="$LOCALSTACK_URL" dynamodb get-item \
        --table-name "users-table" \
        --key "{\"id\":{\"S\":\"$TEST_USER_ID\"}}" \
        --region us-east-1 \
        --output json 2>/dev/null)
    
    if command -v jq &> /dev/null; then
        local stored_id
        local stored_name
        stored_id=$(echo "$item" | jq -r '.Item.id.S // empty')
        stored_name=$(echo "$item" | jq -r '.Item.name.S // empty')
        
        if [ "$stored_id" = "$TEST_USER_ID" ] && [ "$stored_name" = "$TEST_USER_NAME" ]; then
            log_success "LocalStack DynamoDB persistence verification passed"
            log_info "Stored data: ID=$stored_id, Name=$stored_name"
        else
            log_error "LocalStack DynamoDB persistence verification failed"
            log_info "Raw DynamoDB item: $item"
            return 1
        fi
    else
        log_warning "jq not available for detailed validation"
        if echo "$item" | grep -q "$TEST_USER_ID"; then
            log_success "Basic LocalStack DynamoDB persistence check passed"
        else
            log_error "LocalStack DynamoDB persistence verification failed"
            return 1
        fi
    fi
}

# Clean up LocalStack test data
cleanup_localstack() {
    log_info "Cleaning up LocalStack test data..."
    
    # Note: DynamoDB table appears to be created in us-east-1 regardless of CDK config
    aws --no-cli-pager --endpoint-url="$LOCALSTACK_URL" dynamodb delete-item \
        --table-name "users-table" \
        --key "{\"id\":{\"S\":\"$TEST_USER_ID\"}}" \
        --region us-east-1 \
        2>/dev/null || true
    
    log_success "LocalStack test cleanup completed"
}

# Main LocalStack test function
run_localstack_test() {
    log_info "Starting LocalStack Deployment Test"
    log_info "Test User ID: $TEST_USER_ID"
    log_separator
    
    check_localstack
    
    local api_url
    api_url=$(get_localstack_api_url)
    
    create_test_user_localstack "$api_url"
    get_test_user_localstack "$api_url"
    verify_localstack_dynamo
    
    cleanup_localstack
    
    log_footer "All LocalStack tests passed successfully!"
}

# Handle script arguments
case "${1:-test}" in
    "test")
        run_localstack_test
        ;;
    "cleanup")
        log_info "Running LocalStack cleanup only..."
        cleanup_localstack
        ;;
    *)
        echo "Usage: $0 [test|cleanup]"
        echo "  test    - Run full LocalStack test (default)"
        echo "  cleanup - Clean up test data only"
        exit 1
        ;;
esac
