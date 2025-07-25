#!/bin/bash

# Deploy simple Lambda functions and API Gateway directly to LocalStack

set -e

source .env.local

echo "🚀 Deploying directly to LocalStack..."

# Create Lambda functions
echo "Creating Lambda functions..."

# Create user creation function
cat > /tmp/create-user.js << 'EOF'
exports.handler = async (event) => {
  console.log('CreateUser called:', JSON.stringify(event, null, 2));
  
  const body = JSON.parse(event.body || '{}');
  const user = {
    id: 'user-' + Date.now(),
    name: body.name || 'Unknown',
    email: body.email || 'unknown@example.com',
    createdAt: new Date().toISOString()
  };
  
  return {
    statusCode: 201,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
    },
    body: JSON.stringify(user)
  };
};
EOF

# Create user retrieval function
cat > /tmp/get-user.js << 'EOF'
exports.handler = async (event) => {
  console.log('GetUser called:', JSON.stringify(event, null, 2));
  
  const userId = event.pathParameters?.id || 'unknown';
  const user = {
    id: userId,
    name: 'Test User',
    email: 'test@example.com',
    createdAt: '2024-01-01T00:00:00Z'
  };
  
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
    },
    body: JSON.stringify(user)
  };
};
EOF

# Zip the functions
cd /tmp
zip -q create-user.zip create-user.js
zip -q get-user.zip get-user.js

# Create IAM role for Lambda functions
echo "Creating IAM role..."
aws --endpoint-url=$AWS_ENDPOINT_URL --no-paginate --no-cli-pager iam create-role \
  --role-name lambda-execution-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": {
          "Service": "lambda.amazonaws.com"
        },
        "Action": "sts:AssumeRole"
      }
    ]
  }' || echo "Role already exists"

# Wait a moment for role to be available
sleep 2

# Create Lambda functions
echo "Creating CreateUser Lambda function..."
aws --endpoint-url=$AWS_ENDPOINT_URL --no-paginate --no-cli-pager lambda create-function \
  --function-name create-user \
  --runtime nodejs20.x \
  --role arn:aws:iam::000000000000:role/lambda-execution-role \
  --handler create-user.handler \
  --zip-file fileb://create-user.zip \
  --timeout 30 || echo "Function already exists"

echo "Creating GetUser Lambda function..."
aws --endpoint-url=$AWS_ENDPOINT_URL --no-paginate --no-cli-pager lambda create-function \
  --function-name get-user \
  --runtime nodejs20.x \
  --role arn:aws:iam::000000000000:role/lambda-execution-role \
  --handler get-user.handler \
  --zip-file fileb://get-user.zip \
  --timeout 30 || echo "Function already exists"

# Create API Gateway
echo "Creating API Gateway..."
API_ID=$(aws --endpoint-url=$AWS_ENDPOINT_URL --no-paginate --no-cli-pager apigateway create-rest-api \
  --name 'LocalStack User API' \
  --description 'Simple user management API for LocalStack' \
  --query 'id' --output text 2>/dev/null || \
  aws --endpoint-url=$AWS_ENDPOINT_URL --no-paginate --no-cli-pager apigateway get-rest-apis \
  --query 'items[?name==`LocalStack User API`].id' --output text)

echo "API ID: $API_ID"

# Get root resource ID
ROOT_ID=$(aws --endpoint-url=$AWS_ENDPOINT_URL --no-paginate --no-cli-pager apigateway get-resources \
  --rest-api-id $API_ID \
  --query 'items[?path==`/`].id' --output text)

echo "Root resource ID: $ROOT_ID"

# Create /users resource
USERS_ID=$(aws --endpoint-url=$AWS_ENDPOINT_URL --no-paginate --no-cli-pager apigateway create-resource \
  --rest-api-id $API_ID \
  --parent-id $ROOT_ID \
  --path-part users \
  --query 'id' --output text 2>/dev/null || \
  aws --endpoint-url=$AWS_ENDPOINT_URL --no-paginate --no-cli-pager apigateway get-resources \
  --rest-api-id $API_ID \
  --query 'items[?pathPart==`users`].id' --output text)

echo "Users resource ID: $USERS_ID"

# Create /{id} resource under /users
USER_ID_RESOURCE=$(aws --endpoint-url=$AWS_ENDPOINT_URL --no-paginate --no-cli-pager apigateway create-resource \
  --rest-api-id $API_ID \
  --parent-id $USERS_ID \
  --path-part '{id}' \
  --query 'id' --output text 2>/dev/null || \
  aws --endpoint-url=$AWS_ENDPOINT_URL --no-paginate --no-cli-pager apigateway get-resources \
  --rest-api-id $API_ID \
  --query 'items[?pathPart==`{id}`].id' --output text)

echo "User ID resource ID: $USER_ID_RESOURCE"

# Add POST method to /users
aws --endpoint-url=$AWS_ENDPOINT_URL --no-paginate --no-cli-pager apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $USERS_ID \
  --http-method POST \
  --authorization-type NONE || echo "POST method already exists"

# Add GET method to /users/{id}
aws --endpoint-url=$AWS_ENDPOINT_URL --no-paginate --no-cli-pager apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $USER_ID_RESOURCE \
  --http-method GET \
  --authorization-type NONE || echo "GET method already exists"

# Set up Lambda integrations
echo "Setting up Lambda integrations..."

# Integration for POST /users -> create-user
aws --endpoint-url=$AWS_ENDPOINT_URL --no-paginate --no-cli-pager apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $USERS_ID \
  --http-method POST \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri arn:aws:apigateway:us-west-2:lambda:path/2015-03-31/functions/arn:aws:lambda:us-west-2:000000000000:function:create-user/invocations || echo "POST integration already exists"

# Add method response for POST
aws --endpoint-url=$AWS_ENDPOINT_URL --no-paginate --no-cli-pager apigateway put-method-response \
  --rest-api-id $API_ID \
  --resource-id $USERS_ID \
  --http-method POST \
  --status-code 200 || echo "POST method response already exists"

# Integration for GET /users/{id} -> get-user
aws --endpoint-url=$AWS_ENDPOINT_URL --no-paginate --no-cli-pager apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $USER_ID_RESOURCE \
  --http-method GET \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri arn:aws:apigateway:us-west-2:lambda:path/2015-03-31/functions/arn:aws:lambda:us-west-2:000000000000:function:get-user/invocations || echo "GET integration already exists"

# Add method response for GET
aws --endpoint-url=$AWS_ENDPOINT_URL --no-paginate --no-cli-pager apigateway put-method-response \
  --rest-api-id $API_ID \
  --resource-id $USER_ID_RESOURCE \
  --http-method GET \
  --status-code 200 || echo "GET method response already exists"

# Create deployment
echo "Creating deployment..."
DEPLOYMENT_ID=$(aws --endpoint-url=$AWS_ENDPOINT_URL --no-paginate --no-cli-pager apigateway create-deployment \
  --rest-api-id $API_ID \
  --stage-name dev \
  --query 'id' --output text)

echo "Deployment ID: $DEPLOYMENT_ID"

# Get API endpoint
API_ENDPOINT="http://localhost:4566/restapis/$API_ID/dev/_user_request_"

echo ""
echo "✅ Deployment complete!"
echo "API Endpoint: $API_ENDPOINT"
echo ""
echo "Test endpoints:"
echo "  POST $API_ENDPOINT/users"
echo "  GET  $API_ENDPOINT/users/{id}"
echo ""
echo "Example curl commands:"
echo "  curl -X POST $API_ENDPOINT/users -H 'Content-Type: application/json' -d '{\"name\":\"John Doe\",\"email\":\"john@example.com\"}'"
echo "  curl $API_ENDPOINT/users/123"

# Clean up temp files
rm -f /tmp/create-user.js /tmp/get-user.js /tmp/create-user.zip /tmp/get-user.zip
