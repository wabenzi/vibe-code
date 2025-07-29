#!/bin/bash

# Test script to demonstrate AWS CLI pagination behavior

echo "🧪 Testing AWS CLI pagination behavior..."
echo ""

# Set up LocalStack environment
export AWS_ENDPOINT_URL=http://localhost:4566
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-west-2

echo "1. Testing with --no-paginate only (may still paginate due to client-side pager):"
echo "Command: aws --endpoint-url=http://localhost:4566 --no-paginate sts get-caller-identity"
echo "Result:"
timeout 5s aws --endpoint-url=http://localhost:4566 --no-paginate sts get-caller-identity || echo "Command timed out or was interrupted"
echo ""

echo "2. Testing with both --no-paginate and --no-cli-pager (should work in scripts):"
echo "Command: aws --endpoint-url=http://localhost:4566 --no-paginate --no-cli-pager sts get-caller-identity"
echo "Result:"
aws --endpoint-url=http://localhost:4566 --no-paginate --no-cli-pager sts get-caller-identity
echo ""

echo "3. Alternative: Set AWS_PAGER environment variable to empty string:"
echo "Command: AWS_PAGER='' aws --endpoint-url=http://localhost:4566 --no-paginate sts get-caller-identity"
echo "Result:"
AWS_PAGER='' aws --endpoint-url=http://localhost:4566 --no-paginate sts get-caller-identity
echo ""

echo "✅ Pagination test complete!"
echo ""
echo "📝 Key takeaways:"
echo "   - AWS CLI v2 has TWO types of pagination:"
echo "     1. Server-side pagination (controlled by --no-paginate)"
echo "     2. Client-side pager (controlled by --no-cli-pager or AWS_PAGER)"
echo "   - For scripts and automation, you need to disable BOTH"
echo "   - Use: aws --no-paginate --no-cli-pager <command>"
echo "   - Or set: export AWS_PAGER=''"
