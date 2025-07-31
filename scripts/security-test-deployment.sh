#!/bin/bash

# AWS Serverless User API - Security Test with Deployment Environment
# This script runs security tests using the deployed API URL from environment variables

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env.deployment"

echo -e "${BLUE}🔒 AWS Serverless User API - Security Testing${NC}"

# Check if deployment environment file exists
if [ ! -f "${ENV_FILE}" ]; then
    echo -e "${RED}❌ Deployment environment file not found!${NC}"
    echo "Please run 'npm run deploy:export' first to deploy and export environment variables."
    exit 1
fi

echo "📂 Loading deployment environment from .env.deployment"
source "${ENV_FILE}"

# Validate required environment variables
if [ -z "${API_URL}" ]; then
    echo -e "${RED}❌ API_URL not found in deployment environment${NC}"
    exit 1
fi

if [ -z "${API_KEY}" ]; then
    echo -e "${RED}❌ API_KEY not found in deployment environment${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Environment loaded successfully${NC}"
echo "  🌐 API URL: ${API_URL}"
echo "  🔑 API Key: ${API_KEY:0:8}***"
echo ""

# Remove trailing slash from API_URL for consistent testing
API_BASE_URL="${API_URL%/}"

echo -e "${BLUE}🔍 Running Security Tests...${NC}"
echo ""

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function to run security test
run_security_test() {
    local test_name="$1"
    local curl_command="$2"
    local expected_status="$3"
    local description="$4"
    
    echo -n "🔒 $test_name: "
    
    # Run curl and capture status code
    local response
    response=$(eval "${curl_command}" 2>/dev/null)
    local status_code
    status_code=$(echo "${response}" | tail -n1)
    
    if [ "${status_code}" = "${expected_status}" ]; then
        echo -e "${GREEN}✅ PASS${NC} - ${description}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ FAIL${NC} - Expected ${expected_status}, got ${status_code}"
        echo "  Command: ${curl_command}"
        ((TESTS_FAILED++))
    fi
}

# 1. Authentication Tests
echo -e "${YELLOW}📋 Authentication Tests${NC}"

run_security_test \
    "Missing API Key" \
    "curl -s -o /dev/null -w '%{http_code}' '${API_BASE_URL}/users' -X POST -H 'Content-Type: application/json' -d '{\"id\":\"test\",\"name\":\"Test\"}'" \
    "401" \
    "Request without API key should be rejected"

run_security_test \
    "Invalid API Key" \
    "curl -s -o /dev/null -w '%{http_code}' '${API_BASE_URL}/users' -X POST -H 'Content-Type: application/json' -H 'X-Api-Key: invalid-key' -d '{\"id\":\"test\",\"name\":\"Test\"}'" \
    "401" \
    "Request with invalid API key should be rejected"

run_security_test \
    "Valid API Key" \
    "curl -s -o /dev/null -w '%{http_code}' '${API_BASE_URL}/users' -X POST -H 'Content-Type: application/json' -H 'X-Api-Key: $API_KEY' -d '{\"id\":\"security-test-$(date +%s)\",\"name\":\"Security Test\"}'" \
    "201" \
    "Request with valid API key should be accepted"

echo ""

# 2. Input Validation Tests
echo -e "${YELLOW}📋 Input Validation Tests${NC}"

run_security_test \
    "Invalid User ID Format" \
    "curl -s -o /dev/null -w '%{http_code}' '${API_BASE_URL}/users' -X POST -H 'Content-Type: application/json' -H 'X-Api-Key: $API_KEY' -d '{\"id\":\"invalid/id\",\"name\":\"Test\"}'" \
    "400" \
    "Invalid user ID format should be rejected"

run_security_test \
    "Large Payload" \
    "curl -s -o /dev/null -w '%{http_code}' '${API_BASE_URL}/users' -X POST -H 'Content-Type: application/json' -H 'X-Api-Key: $API_KEY' -d '{\"id\":\"test\",\"name\":\"$(printf 'A%.0s' {1..10000})\"}'" \
    "400" \
    "Oversized payload should be rejected"

echo ""

# 3. Security Headers Tests
echo -e "${YELLOW}📋 Security Headers Tests${NC}"

echo -n "🔒 Security Headers: "
HEADERS_RESPONSE=$(curl -s -I -H "X-Api-Key: ${API_KEY}" "${API_BASE_URL}/health")

# Check for required security headers
SECURITY_HEADERS_FOUND=0
SECURITY_HEADERS_TOTAL=4

if echo "${HEADERS_RESPONSE}" | grep -qi "X-Content-Type-Options"; then
    ((SECURITY_HEADERS_FOUND++))
fi

if echo "${HEADERS_RESPONSE}" | grep -qi "X-Frame-Options"; then
    ((SECURITY_HEADERS_FOUND++))
fi

if echo "${HEADERS_RESPONSE}" | grep -qi "Strict-Transport-Security"; then
    ((SECURITY_HEADERS_FOUND++))
fi

if echo "${HEADERS_RESPONSE}" | grep -qi "Content-Security-Policy"; then
    ((SECURITY_HEADERS_FOUND++))
fi

if [ ${SECURITY_HEADERS_FOUND} -eq ${SECURITY_HEADERS_TOTAL} ]; then
    echo -e "${GREEN}✅ PASS${NC} - All security headers present"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAIL${NC} - Only ${SECURITY_HEADERS_FOUND}/${SECURITY_HEADERS_TOTAL} security headers found"
    ((TESTS_FAILED++))
fi

echo ""

# 4. CORS Tests
echo -e "${YELLOW}📋 CORS Tests${NC}"

run_security_test \
    "CORS Preflight" \
    "curl -s -o /dev/null -w '%{http_code}' '${API_BASE_URL}/users' -X OPTIONS -H 'Origin: http://localhost:3000'" \
    "200" \
    "CORS preflight should be handled correctly"

echo ""

# 5. Error Handling Tests
echo -e "${YELLOW}📋 Error Handling Tests${NC}"

echo -n "🔒 Error Information Disclosure: "
ERROR_RESPONSE=$(curl -s -H "X-Api-Key: ${API_KEY}" "$API_BASE_URL/users/non-existent-user" 2>/dev/null)

# Check that error doesn't contain sensitive information
if echo "${ERROR_RESPONSE}" | grep -qi "stack\|trace\|internal\|database\|aws"; then
    echo -e "${RED}❌ FAIL${NC} - Error response may contain sensitive information"
    ((TESTS_FAILED++))
else
    echo -e "${GREEN}✅ PASS${NC} - Error response doesn't leak sensitive information"
    ((TESTS_PASSED++))
fi

echo ""

# 6. Injection Tests
echo -e "${YELLOW}📋 Injection Protection Tests${NC}"

run_security_test \
    "SQL Injection Attempt" \
    "curl -s -o /dev/null -w '%{http_code}' '${API_BASE_URL}/users' -X POST -H 'Content-Type: application/json' -H 'X-Api-Key: $API_KEY' -d '{\"id\":\"test'\\''OR 1=1--\",\"name\":\"Test\"}'" \
    "400" \
    "SQL injection attempt should be blocked"

run_security_test \
    "XSS Injection Attempt" \
    "curl -s -o /dev/null -w '%{http_code}' '${API_BASE_URL}/users' -X POST -H 'Content-Type: application/json' -H 'X-Api-Key: $API_KEY' -d '{\"id\":\"test\",\"name\":\"<script>alert(1)</script>\"}'" \
    "400" \
    "XSS injection attempt should be blocked"

echo ""

# Summary
echo -e "${BLUE}📊 Security Test Summary${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED))

if [ ${TESTS_FAILED} -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL TESTS PASSED! ($TESTS_PASSED/$TOTAL_TESTS)${NC}"
    echo -e "${GREEN}✨ Your API has strong security controls in place${NC}"
    exit 0
else
    echo -e "${RED}⚠️  SOME TESTS FAILED ($TESTS_FAILED/${TOTAL_TESTS} failed)${NC}"
    echo -e "${YELLOW}🔧 Please review and fix the failing security controls${NC}"
    exit 1
fi
