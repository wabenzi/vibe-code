#!/bin/bash

# Security Testing Script for AWS Serverless User Management API
# This script tests the implemented security controls

set -e

echo "🔒 Security Testing Script for User Management API"
echo "================================================="

# Configuration
# Configuration
API_URL="https://bp72trc9ji.execute-api.localhost.localstack.cloud:4566/prod"
API_KEY="tr5ycwc5m3"
INVALID_API_KEY="invalid-key-12345"

echo "Testing API: $API_URL"
echo ""

# Test 1: Authentication - No API Key
echo "1. Testing authentication without API key..."
response=$(curl -s -w "%{http_code}" -X GET "$API_URL/users/test" -o /dev/null)
if [ "$response" -eq 401 ]; then
    echo "✅ PASS: Request without API key correctly returns 401"
else
    echo "❌ FAIL: Expected 401, got $response"
fi
echo ""

# Test 2: Authentication - Invalid API Key
echo "2. Testing authentication with invalid API key..."
response=$(curl -s -w "%{http_code}" -H "X-API-Key: $INVALID_API_KEY" -X GET "$API_URL/users/test" -o /dev/null)
if [ "$response" -eq 401 ]; then
    echo "✅ PASS: Request with invalid API key correctly returns 401"
else
    echo "❌ FAIL: Expected 401, got $response"
fi
echo ""

# Test 3: Authentication - Valid API Key (Health Check)
echo "3. Testing health endpoint (should be public)..."
response=$(curl -s -w "%{http_code}" -X GET "$API_URL/health" -o /dev/null)
if [ "$response" -eq 200 ]; then
    echo "✅ PASS: Health endpoint accessible without authentication"
else
    echo "❌ FAIL: Health endpoint not accessible, got $response"
fi
echo ""

# Test 4: Security Headers
echo "4. Testing security headers..."
if [ "$API_KEY" != "your-api-key-here" ]; then
    # Test security headers on a protected endpoint (will return 401 but with security headers)
    headers=$(curl -s -v -H "X-API-Key: $API_KEY" "$API_URL/users/test-security-headers" 2>&1 | grep "^< " | head -20)
    
    # Check for security headers
    if echo "$headers" | grep -q "x-content-type-options: nosniff"; then
        echo "✅ PASS: X-Content-Type-Options header present"
    else
        echo "❌ FAIL: X-Content-Type-Options header missing"
    fi
    
    if echo "$headers" | grep -q "x-frame-options: DENY"; then
        echo "✅ PASS: X-Frame-Options header present"
    else
        echo "❌ FAIL: X-Frame-Options header missing"
    fi
    
    if echo "$headers" | grep -q "strict-transport-security"; then
        echo "✅ PASS: HSTS header present"
    else
        echo "❌ FAIL: HSTS header missing"
    fi
else
    echo "⚠️  SKIP: Security headers test requires valid API key"
fi
echo ""

# Test 5: CORS Configuration
echo "5. Testing CORS configuration..."
cors_response=$(curl -s -H "Origin: https://malicious-site.com" -H "Access-Control-Request-Method: GET" -X OPTIONS "$API_URL/health")
if echo "$cors_response" | grep -q "https://malicious-site.com"; then
    echo "❌ FAIL: CORS allows requests from unauthorized origins"
else
    echo "✅ PASS: CORS properly restricts origins"
fi
echo ""

# Test 6: Input Validation
echo "6. Testing input validation..."
if [ "$API_KEY" != "your-api-key-here" ]; then
    # Test with invalid user ID format (contains special characters that our validation rejects)
    response=$(curl -s -w "%{http_code}" -H "X-API-Key: $API_KEY" -X GET "$API_URL/users/invalid%23user" -o /dev/null)
    if [ "$response" -eq 400 ]; then
        echo "✅ PASS: Invalid user ID format correctly rejected"
    else
        echo "❌ FAIL: Invalid input not properly validated, got $response"
    fi
    
    # Test with oversized request
    large_payload=$(printf '{"id":"test","name":"%*s"}' 2000 "")
    response=$(curl -s -w "%{http_code}" -H "X-API-Key: $API_KEY" -H "Content-Type: application/json" -X POST "$API_URL/users" -d "$large_payload" -o /dev/null)
    if [ "$response" -ge 400 ]; then
        echo "✅ PASS: Large payload properly handled"
    else
        echo "⚠️  WARNING: Large payload accepted, response: $response"
    fi
else
    echo "⚠️  SKIP: Valid API key not provided, skipping input validation tests"
fi
echo ""

# Test 7: Rate Limiting (if valid API key provided)
echo "7. Testing rate limiting..."
if [ "$API_KEY" != "your-api-key-here" ]; then
    echo "Sending 10 rapid requests to test rate limiting..."
    rate_limit_hit=false
    # shellcheck disable=SC2034
    for i in {1..10}; do
        response=$(curl -s -w "%{http_code}" -H "X-API-Key: $API_KEY" -X GET "$API_URL/health" -o /dev/null)
        if [ "$response" -eq 429 ]; then
            rate_limit_hit=true
            break
        fi
        sleep 0.1
    done
    
    if [ "$rate_limit_hit" = true ]; then
        echo "✅ PASS: Rate limiting is working"
    else
        echo "⚠️  INFO: Rate limit not hit with 10 requests (may need more requests)"
    fi
else
    echo "⚠️  SKIP: Valid API key not provided, skipping rate limit tests"
fi
echo ""

# Test 8: Error Information Disclosure
echo "8. Testing error information disclosure..."
error_response=$(curl -s -H "X-API-Key: $API_KEY" -X GET "$API_URL/users/nonexistent" 2>/dev/null || true)
if echo "$error_response" | grep -q "stack\|trace\|internal\|database"; then
    echo "❌ FAIL: Error response may contain sensitive information"
    echo "Response: $error_response"
else
    echo "✅ PASS: Error responses don't expose sensitive information"
fi
echo ""

# Test 9: HTTPS Enforcement
echo "9. Testing HTTPS enforcement..."
if [[ "$API_URL" == https://* ]]; then
    echo "✅ PASS: API is using HTTPS"
else
    echo "❌ FAIL: API is not using HTTPS"
fi
echo ""

# Test 10: SQL/NoSQL Injection Attempts
echo "10. Testing injection protection..."
if [ "$API_KEY" != "your-api-key-here" ]; then
    # Test with potential injection payloads
    injection_payloads=(
        "'; DROP TABLE users; --"
        "' OR '1'='1"
        "<script>alert('xss')</script>"
        "../../../etc/passwd"
    )
    
    injection_blocked=true
    for payload in "${injection_payloads[@]}"; do
        encoded_payload="${payload// /%20/g}" #minimal encodng to allow injection
        response=$(curl -s -w "%{http_code}" -H "X-API-Key: $API_KEY" -X GET "$API_URL/users/$encoded_payload" -o /dev/null)
        if [ "$response" -eq 200 ]; then
            injection_blocked=false
            echo "❌ FAIL: Injection payload may have been processed: $payload"
        fi
    done
    
    if [ "$injection_blocked" = true ]; then
        echo "✅ PASS: Injection attempts properly blocked"
    fi
else
    echo "⚠️  SKIP: Valid API key not provided, skipping injection tests"
fi
echo ""

# Summary
echo "🔒 Security Test Summary"
echo "======================="
echo "Run this script with:"
echo "API_URL=https://your-api-gateway-url/prod API_KEY=your-api-key ./security-test.sh"
echo ""
echo "For comprehensive security testing:"
echo "1. Run this script after each deployment"
echo "2. Monitor CloudWatch logs for security events"
echo "3. Review AWS WAF metrics if enabled"
echo "4. Consider running automated security scans (OWASP ZAP, etc.)"
echo ""
echo "✅ Testing complete!"
