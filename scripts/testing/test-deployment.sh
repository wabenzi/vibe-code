#!/bin/bash

# AWS Serverless API Deployment Test Script
# This script tests the deployment by:
# 1. Checking if test user exists and deleting it
# 2. Creating a new test user
# 3. Retrieving the user via API
# 4. Verifying persistence in DynamoDB
# 5. Cleaning up test data

set -e
#set -o inherit_errexit

#set -x  # Enable debug mode

# Source common logging functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "${SCRIPT_DIR}")"
# shellcheck source=scripts/utils/common-logging.sh
LOG_PREFIX="TEST" source "${PROJECT_DIR}/utils/common-logging.sh"

# Configuration
TEST_USER_ID="test-user-deployment-$(date +%s)"
TEST_USER_NAME="Test User Deployment"
STACK_NAME="UserApiStack"
TABLE_NAME="users-table"

declare api_url

# Check if required tools are installed
check_dependencies() {
	log_info "Checking dependencies..."

	if ! command -v aws &>/dev/null; then
		log_error "AWS CLI is not installed"
		exit 1
	fi

	if ! command -v curl &>/dev/null; then
		log_error "curl is not installed"
		exit 1
	fi

	if ! command -v jq &>/dev/null; then
		log_error "jq is not installed. Please run './scripts/macOS-setup.sh' or install jq manually."
		exit 1
	fi

	log_success "Dependencies check passed"
}


# Get API Gateway URL from CloudFormation stack
get_api_url() {
	log_info "Getting API Gateway URL from CloudFormation stack..."
 
	api_url=$(aws --no-cli-pager cloudformation describe-stacks \
		--stack-name "${STACK_NAME}" \
		--query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
		--output text | head -n1) || { 
		log_error "Failed to invoke aws for stack ${STACK_NAME}"
		return 1
	}
     
	if [[ -z "${api_url}" ]] || [[ "${api_url}" = "None" ]]; then
		log_error "Could not retrieve API URL from stack ${STACK_NAME}"
		return 1
	fi

	# Remove trailing slash if present
	api_url=${api_url%/}

	log_success "API URL: ${api_url}"
}

# Check if user exists in DynamoDB and delete if found
cleanup_test_user() {
	log_info "Checking if test user exists in DynamoDB..."

	local existing_user
	existing_user=$(aws --no-cli-pager dynamodb get-item \
		--table-name "${TABLE_NAME}" \
		--key "{\"id\":{\"S\":\"${TEST_USER_ID}\"}}" \
		--query "Item" \
		--output text 2>/dev/null)

	if [[ "${existing_user}" != "None" ]] && [[ -n "${existing_user}" ]]; then
		log_warning "Test user ${TEST_USER_ID} already exists. Deleting..."
		aws --no-cli-pager dynamodb delete-item \
			--table-name "${TABLE_NAME}" \
			--key "{\"id\":{\"S\":\"${TEST_USER_ID}\"}}"
		log_success "Existing test user deleted"
	else
		log_info "No existing test user found"
	fi
}

# Create test user via API
create_test_user() {
	local api_url="$1"
	log_info "Creating test user via API..."

	local response
	response=$(curl -s -w "\n%{http_code}" -X POST \
		"${api_url}/users" \
		-H "Content-Type: application/json" \
		-d "{\"id\":\"${TEST_USER_ID}\",\"name\":\"${TEST_USER_NAME}\"}")

	local http_code
	local body
	http_code=$(echo "${response}" | tail -n1)
	body=$(echo "${response}" | head -n -1)

	if [[ "${http_code}" = "200" ]] || [[ "${http_code}" = "201" ]]; then
		log_success "User created successfully"
		
		# Enhanced JSON output with jq formatting
		log_info "Response (formatted):"
		echo "${body}" | jq '.'

		# Validate response contains expected fields with detailed feedback
		local user_id user_name created_at updated_at
		user_id=$(echo "${body}" | jq -r '.id // empty')
		user_name=$(echo "${body}" | jq -r '.name // empty')
		created_at=$(echo "${body}" | jq -r '.createdAt // empty')
		updated_at=$(echo "${body}" | jq -r '.updatedAt // empty')

		log_info "Validating response fields:"
		echo "  Expected ID: ${TEST_USER_ID}"
		echo "  Actual ID:   ${user_id}"
		echo "  Expected Name: ${TEST_USER_NAME}"
		echo "  Actual Name:   ${user_name}"
		echo "  Created At:    ${created_at}"
		echo "  Updated At:    ${updated_at}"

		if [[ "${user_id}" = "${TEST_USER_ID}" ]] && [[ "${user_name}" = "${TEST_USER_NAME}" ]] && [[ -n "${created_at}" ]] && [[ -n "${updated_at}" ]]; then
			log_success "Response validation passed"
			
			# Validate timestamp format (ISO 8601)
			if echo "${created_at}" | grep -qE '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}'; then
				log_success "Timestamp format validation passed"
			else
				log_warning "Timestamp format may be incorrect: ${created_at}"
			fi
		else
			log_error "Response validation failed"
			return 1
		fi
	else
		log_error "Failed to create user. HTTP code: ${http_code}"
		log_error "Response: ${body}"
		return 1
	fi
}

# Retrieve test user via API
get_test_user() {
	local api_url="$1"
	if [[ -z "${api_url}" ]]; then
		log_error "API URL is required for get_test_user"
		return 1
	fi
	log_info "Retrieving test user via API..."

	local response
	local http_code
	local body
	response=$(curl -s -w "\n%{http_code}" -X GET \
		"${api_url}/users/${TEST_USER_ID}")

	http_code=$(echo "${response}" | tail -n1)
	body=$(echo "${response}" | head -n -1)

	if [[ "${http_code}" = "200" ]]; then
		log_success "User retrieved successfully"
		log_info "Response: ${body}"

		# Validate response
		if command -v jq &>/dev/null; then
			local user_id
			local user_name
			user_id=$(echo "${body}" | jq -r '.id // empty')
			user_name=$(echo "${body}" | jq -r '.name // empty')

			if [[ "${user_id}" = "${TEST_USER_ID}" ]] && [[ "${user_name}" = "${TEST_USER_NAME}" ]]; then
				log_success "GET response validation passed"
			else
				log_error "GET response validation failed"
				return 1
			fi
		fi
	else
		log_error "Failed to retrieve user. HTTP code: ${http_code}"
		log_error "Response: ${body}"
		return 1
	fi
}

# Verify user exists in DynamoDB
verify_dynamo_persistence() {
	log_info "Verifying user persistence in DynamoDB..."

	local item
	item=$(aws --no-cli-pager dynamodb get-item \
		--table-name "${TABLE_NAME}" \
		--key "{\"id\":{\"S\":\"${TEST_USER_ID}\"}}" \
		--output json)

	# Enhanced DynamoDB verification with detailed output
	if command -v jq >/dev/null 2>&1; then
		local stored_id stored_name stored_created_at stored_updated_at
		stored_id=$(echo "${item}" | jq -r '.Item.id.S // empty')
		stored_name=$(echo "${item}" | jq -r '.Item.name.S // empty')
		stored_created_at=$(echo "${item}" | jq -r '.Item.createdAt.S // empty')
		stored_updated_at=$(echo "${item}" | jq -r '.Item.updatedAt.S // empty')

		log_info "DynamoDB stored data:"
		echo "${item}" | jq '.Item'

		if [[ "${stored_id}" == "${TEST_USER_ID}" ]] && [[ "${stored_name}" == "${TEST_USER_NAME}" ]]; then
			log_success "DynamoDB persistence verification passed"
			log_info "✅ ID matches: ${stored_id}"
			log_info "✅ Name matches: ${stored_name}"
			log_info "✅ Created at: ${stored_created_at}"
			log_info "✅ Updated at: ${stored_updated_at}"
			
			# Verify all expected fields are present
			local missing_fields=0
			[[ -z "${stored_created_at}" ]] && log_warning "Missing createdAt field" && ((missing_fields++))
			[[ -z "${stored_updated_at}" ]] && log_warning "Missing updatedAt field" && ((missing_fields++))
			
			if [[ "${missing_fields}" -eq 0 ]]; then
				log_success "All expected fields present in DynamoDB"
			else
				log_warning "${missing_fields} fields missing from DynamoDB record"
			fi
		else
			log_error "DynamoDB persistence verification failed"
			log_error "Expected: ID=${TEST_USER_ID}, Name=${TEST_USER_NAME}"
			log_error "Found: ID=${stored_id}, Name=${stored_name}"
			return 1
		fi
	else
		# Basic check without jq
		if echo "${item}" | grep -q "${TEST_USER_ID}" && echo "${item}" | grep -q "${TEST_USER_NAME}"; then
			log_success "DynamoDB persistence verification passed (basic check)"
		else
			log_error "DynamoDB persistence verification failed"
			log_error "Item: ${item}"
			return 1
		fi
	fi
}

# Test error handling with non-existent user
test_error_handling() {
	local api_url
	api_url="$1"
	log_info "Testing error handling with non-existent user..."

	local nonexistent_id
	local response
	nonexistent_id="nonexistent-user-$(date +%s)"
	response=$(curl -s -w "\n%{http_code}" -X GET \
		"${api_url}/users/${nonexistent_id}")

	local http_code
	local body
	http_code=$(echo "${response}" | tail -n1)
	body=$(echo "${response}" | head -n -1)

	if [[ "${http_code}" == "404" ]] || [[ "${http_code}" == "500" ]]; then
		log_success "Error handling test passed (HTTP ${http_code})"
		log_info "Error response: ${body}"
	else
		log_warning "Unexpected response for non-existent user: HTTP ${http_code}"
		log_info "Response: ${body}"
	fi
}

# Clean up test data
final_cleanup() {
	log_info "Cleaning up test data..."

	aws --no-cli-pager dynamodb delete-item \
		--table-name "${TABLE_NAME}" \
		--key "{\"id\":{\"S\":\"${TEST_USER_ID}\"}}" \
		2>/dev/null || true

	log_success "Test cleanup completed"
}

# Check stack status
check_stack_status() {
	log_info "Checking CloudFormation stack status..."

	local stack_status
	stack_status=$(aws --no-cli-pager cloudformation describe-stacks \
		--stack-name "${STACK_NAME}" \
		--query "Stacks[0].StackStatus" \
		--output text 2>/dev/null)
	local aws_exit_code=$?

	if [[ ${aws_exit_code} -ne 0 ]] || [[ -z "${stack_status}" ]] || [[ "${stack_status}" == "None" ]]; then
		log_error "Failed to retrieve stack status for ${STACK_NAME}"
		exit 1
	fi

	if [[ "${stack_status}" == "CREATE_COMPLETE" ]] || [[ "${stack_status}" == "UPDATE_COMPLETE" ]]; then
		log_success "Stack ${STACK_NAME} is in good state: ${stack_status}"
	else
		log_error "Stack ${STACK_NAME} is in unexpected state: ${stack_status}"
		exit 1
	fi
}

# Main test function
run_deployment_test() {
	log_info "Starting AWS Serverless API Deployment Test"
	log_info "Test User ID: ${TEST_USER_ID}"
	log_separator

	# Check dependencies
	check_dependencies || exit 1

	# Check stack status
	check_stack_status || exit 1

	# Get API URL using existing function
	get_api_url || { 
		log_error "Failed to get API URL"
		exit 1
	}
	
	if [[ -z "${api_url}" ]]; then
		log_error "API URL is empty. Cannot proceed with tests."
		exit 1
	fi

	# Clean up any existing test data
	cleanup_test_user || exit 1

	# Run tests
	create_test_user "${api_url}" || { log_error "create_test_user failed"; exit 1; }
	get_test_user "${api_url}" || { log_error "get_test_user failed"; exit 1; }
	verify_dynamo_persistence || { log_error "verify_dynamo_persistence failed"; exit 1; }
	test_error_handling "${api_url}" || { log_error "test_error_handling failed"; exit 1; }

	# Clean up
	final_cleanup

	log_footer "All deployment tests passed successfully! API is working correctly with DynamoDB persistence"
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
	get_api_url >/dev/null
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
