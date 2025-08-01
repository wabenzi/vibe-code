#!/bin/bash

# API Testing Script
# Usage: ./scripts/test-api.sh [API_URL]

set -e

# Get API URL from parameter or try to extract from CDK outputs
if [ -n "$1" ]; then
  API_URL="$1"
  echo "🧪 Using provided API URL: $API_URL"
elif [ -f "cdk-outputs.json" ]; then
  # Try to extract from UserApiStack first (AWS deployment)
  API_URL=$(cat cdk-outputs.json | jq -r '.UserApiStack.ApiUrl // .UserApiStack.UserApiEndpoint22DD5314' 2>/dev/null || echo "")
  
  # If not found, try LocalUserApiStack (LocalStack deployment)
  if [ -z "$API_URL" ] || [ "$API_URL" = "null" ]; then
    API_URL=$(cat cdk-outputs.json | jq -r '.LocalUserApiStack.ApiUrl // .LocalUserApiStack.UserApiEndpoint22DD5314' 2>/dev/null || echo "")
  fi
  
  if [ -n "$API_URL" ] && [ "$API_URL" != "null" ]; then
    echo "📡 Extracted API URL from CDK outputs: $API_URL"
  fi
fi

if [ -z "$API_URL" ]; then
  echo "❌ No API URL provided and could not extract from CDK outputs"
  echo "Usage: $0 [API_URL]"
  echo "Or ensure cdk-outputs.json exists with deployment outputs"
  exit 1
fi

# Export for tests
export API_BASE_URL="$API_URL"

echo "🧪 Running API tests against: $API_URL"
echo "================================="

# Run health check first
echo "🏥 Checking API health..."
if curl -f -s "$API_URL/health" > /dev/null; then
  echo "✅ API health check passed"
else
  echo "⚠️  API health check failed, but continuing with tests..."
fi

# Run the production API tests
echo "🚀 Running production API test suite..."
npm run test:api:prod

if [ $? -eq 0 ]; then
  echo ""
  echo "🎉 All API tests passed!"
  echo "✅ Deployment is working correctly"
else
  echo ""
  echo "❌ Some API tests failed"
  echo "Check the output above for details"
  exit 1
fi
