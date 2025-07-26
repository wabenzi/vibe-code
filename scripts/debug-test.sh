#!/bin/bash

# Debug version of deployment test
set -x  # Enable debug mode

STACK_NAME="UserApiStack"
TEST_USER_ID="test-user-debug-$(date +%s)"
TEST_USER_NAME="Debug Test User"

echo "Getting API URL..."
api_url=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
    --output text | head -n1)

echo "Raw API URL: [$api_url]"
api_url=${api_url%/}
echo "Cleaned API URL: [$api_url]"

echo "Creating user..."
response=$(curl -s -w "\n%{http_code}" -X POST \
    "$api_url/users" \
    -H "Content-Type: application/json" \
    -d "{\"id\":\"$TEST_USER_ID\",\"name\":\"$TEST_USER_NAME\"}")

echo "Full response:"
echo "$response"

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n -1)

echo "HTTP Code: [$http_code]"
echo "Body: [$body]"

# Cleanup
aws dynamodb delete-item \
    --table-name "users-table" \
    --key "{\"id\":{\"S\":\"$TEST_USER_ID\"}}" \
    2>/dev/null || true
