#!/bin/bash

# AWS Serverless API Deployment Test Script
# This script tests the deployment by:
# 1. Checking if test user exists and deleting it
# 2. Creating a new test user
# 3. Retrieving the user via API
# 4. Verifying persistence in DynamoDB
# 5. Cleaning up test data

set -e

# Configuration
TEST_USER_ID="test-user-deployment-$(date +%s)"
TEST_USER_NAME="Test User Deployment"
STACK_NAME="UserApiStack"
TABLE_NAME="users-table"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

# Check if required tools are installed
check_dependencies() {
    log_info "Checking dependencies..."
    
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed"
        exit 1
    fi
    
    if ! command -v curl &> /dev/null; then
        log_error "curl is not installed"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        log_warning "jq is not installed. JSON parsing will be limited."
    fi
    
    log_success "Dependencies check passed"
}

# Get API Gateway URL from CloudFormation stack
get_api_url() {
    log_info "Getting API Gateway URL from CloudFormation stack..."
    
    local api_url=$(aws --no-cli-pager cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
        --output text | head -n1)
    
    if [ -z "$api_url" ] || [ "$api_url" = "None" ]; then
        log_error "Could not retrieve API URL from stack $STACK_NAME"
        exit 1
    fi
    
    # Remove trailing slash if present
    api_url=${api_url%/}
    
    log_success "API URL: $api_url"
    echo "$api_url"
}

# Check if user exists in DynamoDB and delete if found
cleanup_test_user() {
    log_info "Checking if test user exists in DynamoDB..."
    
    local existing_user=$(aws --no-cli-pager dynamodb get-item \
        --table-name "$TABLE_NAME" \
        --key "{\"id\":{\"S\":\"$TEST_USER_ID\"}}" \
        --query "Item" \
        --output text 2>/dev/null)
    
    if [ "$existing_user" != "None" ] && [ -n "$existing_user" ]; then
        log_warning "Test user $TEST_USER_ID already exists. Deleting..."
        aws --no-cli-pager dynamodb delete-item \
            --table-name "$TABLE_NAME" \
            --key "{\"id\":{\"S\":\"$TEST_USER_ID\"}}"
        log_success "Existing test user deleted"
    else
        log_info "No existing test user found"
    fi
}

# Create test user via API
create_test_user() {
    local api_url="$1"
    log_info "Creating test user via API..."
    
    local response=$(curl -s -w "\n%{http_code}" -X POST \
        "$api_url/users" \
        -H "Content-Type: application/json" \
        -d "{\"id\":\"$TEST_USER_ID\",\"name\":\"$TEST_USER_NAME\"}")
    
    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        log_success "User created successfully"
        log_info "Response: $body"
        
        # Validate response contains expected fields
        if command -v jq &> /dev/null; then
            local user_id=$(echo "$body" | jq -r '.id // empty')
            local user_name=$(echo "$body" | jq -r '.name // empty')
            local created_at=$(echo "$body" | jq -r '.createdAt // empty')
            
            if [ "$user_id" = "$TEST_USER_ID" ] && [ "$user_name" = "$TEST_USER_NAME" ] && [ -n "$created_at" ]; then
                log_success "Response validation passed"
            else
                log_error "Response validation failed"
                return 1
            fi
        fi
    else
        log_error "Failed to create user. HTTP code: $http_code"
        log_error "Response: $body"
        return 1
    fi
}

# Retrieve test user via API
get_test_user() {
    local api_url="$1"
    log_info "Retrieving test user via API..."
    
    local response=$(curl -s -w "\n%{http_code}" -X GET \
        "$api_url/users/$TEST_USER_ID")
    
    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" = "200" ]; then
        log_success "User retrieved successfully"
        log_info "Response: $body"
        
        # Validate response
        if command -v jq &> /dev/null; then
            local user_id=$(echo "$body" | jq -r '.id // empty')
            local user_name=$(echo "$body" | jq -r '.name // empty')
            
            if [ "$user_id" = "$TEST_USER_ID" ] && [ "$user_name" = "$TEST_USER_NAME" ]; then
                log_success "GET response validation passed"
            else
                log_error "GET response validation failed"
                return 1
            fi
        fi
    else
        log_error "Failed to retrieve user. HTTP code: $http_code"
        log_error "Response: $body"
        return 1
    fi
}

# Verify user exists in DynamoDB
verify_dynamo_persistence() {
    log_info "Verifying user persistence in DynamoDB..."
    
    local item=$(aws --no-cli-pager dynamodb get-item \
        --table-name "$TABLE_NAME" \
        --key "{\"id\":{\"S\":\"$TEST_USER_ID\"}}" \
        --output json)
    
    if command -v jq &> /dev/null; then
        local stored_id=$(echo "$item" | jq -r '.Item.id.S // empty')
        local stored_name=$(echo "$item" | jq -r '.Item.name.S // empty')
        
        if [ "$stored_id" = "$TEST_USER_ID" ] && [ "$stored_name" = "$TEST_USER_NAME" ]; then
            log_success "DynamoDB persistence verification passed"
            log_info "Stored data: ID=$stored_id, Name=$stored_name"
        else
            log_error "DynamoDB persistence verification failed"
            log_error "Expected: ID=$TEST_USER_ID, Name=$TEST_USER_NAME"
            log_error "Found: ID=$stored_id, Name=$stored_name"
            return 1
        fi
    else
        # Basic check without jq
        if echo "$item" | grep -q "$TEST_USER_ID" && echo "$item" | grep -q "$TEST_USER_NAME"; then
            log_success "DynamoDB persistence verification passed (basic check)"
        else
            log_error "DynamoDB persistence verification failed"
            log_error "Item: $item"
            return 1
        fi
    fi
}

# Test error handling with non-existent user
test_error_handling() {
    local api_url="$1"
    log_info "Testing error handling with non-existent user..."
    
    local nonexistent_id="nonexistent-user-$(date +%s)"
    local response=$(curl -s -w "\n%{http_code}" -X GET \
        "$api_url/users/$nonexistent_id")
    
    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" = "404" ] || [ "$http_code" = "500" ]; then
        log_success "Error handling test passed (HTTP $http_code)"
        log_info "Error response: $body"
    else
        log_warning "Unexpected response for non-existent user: HTTP $http_code"
        log_info "Response: $body"
    fi
}

# Clean up test data
final_cleanup() {
    log_info "Cleaning up test data..."
    
    aws --no-cli-pager dynamodb delete-item \
        --table-name "$TABLE_NAME" \
        --key "{\"id\":{\"S\":\"$TEST_USER_ID\"}}" \
        2>/dev/null || true
    
    log_success "Test cleanup completed"
}

# Check stack status
check_stack_status() {
    log_info "Checking CloudFormation stack status..."
    
    local stack_status=$(aws --no-cli-pager cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --query "Stacks[0].StackStatus" \
        --output text 2>/dev/null)
    
    if [ "$stack_status" = "CREATE_COMPLETE" ] || [ "$stack_status" = "UPDATE_COMPLETE" ]; then
        log_success "Stack $STACK_NAME is in good state: $stack_status"
    else
        log_error "Stack $STACK_NAME is in unexpected state: $stack_status"
        exit 1
    fi
}

# Main test function
run_deployment_test() {
    log_info "Starting AWS Serverless API Deployment Test"
    log_info "Test User ID: $TEST_USER_ID"
    log_info "=========================================="
    
    # Check dependencies
    check_dependencies
    
    # Check stack status
    check_stack_status
    
    # Get API URL
    log_info "Getting API Gateway URL from CloudFormation stack..."
    local api_url=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
        --output text | head -n1)
    
    if [ -z "$api_url" ] || [ "$api_url" = "None" ]; then
        log_error "Could not retrieve API URL from stack $STACK_NAME"
        exit 1
    fi
    
    # Remove trailing slash if present
    api_url=${api_url%/}
    log_success "API URL: $api_url"
    
    # Clean up any existing test data
    cleanup_test_user
    
    # Run tests
    create_test_user "$api_url"
    get_test_user "$api_url"
    verify_dynamo_persistence
    test_error_handling "$api_url"
    
    # Clean up
    final_cleanup
    
    log_success "=========================================="
    log_success "All deployment tests passed successfully!"
    log_success "API is working correctly with DynamoDB persistence"
}

# Handle script arguments
case "${1:-test}" in
    "test")
        run_deployment_test
        ;;
    "cleanup")
        log_info "Running cleanup only..."
        cleanup_test_user
        ;;
    "check")
        log_info "Running health check only..."
        check_dependencies
        check_stack_status
        get_api_url > /dev/null
        log_success "Health check passed"
        ;;
    *)
        echo "Usage: $0 [test|cleanup|check]"
        echo "  test    - Run full deployment test (default)"
        echo "  cleanup - Clean up test data only"
        echo "  check   - Run health check only"
        exit 1
        ;;
esac
