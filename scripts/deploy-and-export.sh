#!/bin/bash

# AWS Serverless User API - Deploy and Export Environment Variables
# This script deploys the CDK stack and exports key outputs as environment variables

set -e

# Set custom log prefix and source common logging library
export LOG_PREFIX="DEPLOY"
source "$(dirname "$0")/common-logging.sh"

# Project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env.deployment"

log_header "🚀 AWS Serverless User API - Deploy and Export"
log_info "Project root: ${PROJECT_ROOT}"

# Detect deployment environment
if [[ -n "${AWS_ENDPOINT_URL}" || "${CDK_DEFAULT_ACCOUNT}" == "000000000000" ]]; then
    log_warning "🐳 Deploying to LocalStack"
    IS_LOCAL=true
    DEPLOY_CMD="cdklocal deploy"
else
    log_success "☁️  Deploying to AWS"
    IS_LOCAL=false
    DEPLOY_CMD="cdk deploy"
fi

# Source existing environment files
if [[ -f "${PROJECT_ROOT}/.env.local" ]]; then
    log_info "📂 Loading .env.local"
    source "${PROJECT_ROOT}/.env.local"
fi

if [[ -f "${PROJECT_ROOT}/.env" ]]; then
    log_info "📂 Loading .env"
    source "${PROJECT_ROOT}/.env"
fi

# Deploy the stack and capture outputs
log_section "🏗️  Deploying infrastructure..."
DEPLOY_OUTPUT=$(cd "${PROJECT_ROOT}" && ${DEPLOY_CMD} --outputs-file cdk-outputs.json 2>&1)
DEPLOY_EXIT_CODE=$?

if [[ ${DEPLOY_EXIT_CODE} -ne 0 ]]; then
    log_error "❌ Deployment failed!"
    echo "${DEPLOY_OUTPUT}"
    exit 1
fi

log_success "✅ Deployment successful!"

# Check if outputs file was created
if [[ ! -f "${PROJECT_ROOT}/cdk-outputs.json" ]]; then
    log_warning "⚠️  No outputs file generated, extracting from deploy output..."
    
    # Extract outputs from deploy output
    API_URL=""
    API_KEY=""
    
    # Parse outputs from deployment text
    while IFS= read -r line; do
        if [[ ${line} =~ ApiUrl[[:space:]]*=[[:space:]]*(https?://[^[:space:]]*) ]]; then
            API_URL="${BASH_REMATCH[1]}"
        elif [[ ${line} =~ ApiKeyOutput[[:space:]]*=[[:space:]]*([^[:space:]]*) ]]; then
            API_KEY="${BASH_REMATCH[1]}"
        fi
    done <<< "${DEPLOY_OUTPUT}"
else
    log_info "📄 Reading outputs from cdk-outputs.json"
    
    # Extract values from JSON outputs  
    API_URL=$(grep -o '"ApiUrl": *"[^"]*"' "${PROJECT_ROOT}/cdk-outputs.json" | cut -d'"' -f4 | head -1)
    API_KEY=$(grep -o '"ApiKeyOutput": *"[^"]*"' "${PROJECT_ROOT}/cdk-outputs.json" | cut -d'"' -f4 | head -1)
    
    # Fallback: try with different stack naming
    if [[ -z "${API_URL}" ]]; then
        API_URL=$(grep -o '"[^"]*ApiUrl[^"]*": *"[^"]*"' "${PROJECT_ROOT}/cdk-outputs.json" | cut -d'"' -f4 | head -1)
    fi
    
    if [[ -z "${API_KEY}" ]]; then
        API_KEY=$(grep -o '"[^"]*ApiKeyOutput[^"]*": *"[^"]*"' "${PROJECT_ROOT}/cdk-outputs.json" | cut -d'"' -f4 | head -1)
    fi
fi

# Validate we got the required values
if [[ -z "${API_URL}" ]]; then
    log_error "❌ Failed to extract API URL from deployment outputs"
    log_info "Deployment output:"
    echo "${DEPLOY_OUTPUT}"
    exit 1
fi

if [[ -z "${API_KEY}" ]]; then
    log_warning "⚠️  No API key found in outputs, using default"
    API_KEY="${API_KEY:-tr5ycwc5m3}"
fi

# Create/update deployment environment file
log_info "📝 Creating deployment environment file..."
cat > "${ENV_FILE}" << EOF
# Deployment Environment Variables
# Generated on: $(date)
# Deployment Type: $([[ "${IS_LOCAL}" = true ]] && echo "LocalStack" || echo "AWS")

# API Configuration
export API_URL="${API_URL}"
export API_KEY="${API_KEY}"

# Derived variables
export API_BASE_URL="\${API_URL%/}"  # Remove trailing slash if present
export API_HEALTH_URL="\${API_BASE_URL}/health"
export API_USERS_URL="\${API_BASE_URL}/users"

# Test Configuration
export INTEGRATION_TEST_API_URL="\${API_URL}"
export INTEGRATION_TEST_API_KEY="\${API_KEY}"

# Environment detection
export IS_LOCALSTACK="${IS_LOCAL}"
export DEPLOYMENT_TIMESTAMP="$(date -u +%Y%m%d_%H%M%S)"
EOF

# Make the file executable for sourcing
chmod +x "${ENV_FILE}"

log_success "✅ Environment variables exported to: ${ENV_FILE}"
log_separator
log_section "📊 Deployment Summary:"
log_info "  🌐 API URL: ${API_URL}"
log_info "  🔑 API Key: ${API_KEY}"
log_info "  🏠 Environment: $([[ "${IS_LOCAL}" = true ]] && echo "LocalStack" || echo "AWS")"
log_separator
log_warning "💡 Usage:"
log_info "  source ${ENV_FILE}"
log_info "  npm run test:integration"
log_separator
log_success "🎉 Ready for testing and development!"

# Optionally run a quick health check
if command -v curl >/dev/null 2>&1; then
    log_separator
    log_section "🏥 Running health check..."
    
    HEALTH_URL="${API_URL%/}/health"
    if curl -s -f -H "X-Api-Key: ${API_KEY}" "${HEALTH_URL}" >/dev/null; then
        log_success "✅ API health check passed"
    else
        log_warning "⚠️  API health check failed (this might be normal for fresh deployments)"
    fi
fi
