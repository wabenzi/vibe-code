#!/bin/bash

# AWS Serverless User API - macOS Setup Script
# Complete development environment setup for macOS

set -e

echo "🚀 AWS Serverless User API - macOS Setup"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check if Homebrew is installed
check_homebrew() {
    log_info "Checking for Homebrew..."
    if ! command_exists brew; then
        log_warning "Homebrew not found. Installing Homebrew..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        
        # Add Homebrew to PATH for Apple Silicon Macs
        if [[ $(uname -m) == 'arm64' ]]; then
            echo "eval \"\$(/opt/homebrew/bin/brew shellenv)\"" >> ~/.zprofile
            eval "$(/opt/homebrew/bin/brew shellenv)"
        fi
        
        log_success "Homebrew installed successfully"
    else
        log_success "Homebrew is already installed"
        log_info "Updating Homebrew..."
        brew update
    fi
}

# Install system dependencies
install_system_dependencies() {
    log_info "Installing system dependencies via Homebrew..."
    
    # Essential tools
    local deps=(
        "node@20"      # Node.js 20 LTS
        "awscli"       # AWS CLI
        "docker"       # Docker Desktop
        "jq"           # JSON processor
        "bc"           # Calculator for scripts
    )
    
    for dep in "${deps[@]}"; do
        log_info "Installing ${dep}..."
        if brew list "${dep}" >/dev/null 2>&1; then
            log_success "${dep} is already installed"
        else
            brew install "${dep}"
            log_success "${dep} installed successfully"
        fi
    done
    
    # Start Docker Desktop if not running
    if ! docker info >/dev/null 2>&1; then
        log_warning "Docker is not running. Please start Docker Desktop manually."
        log_info "You can find Docker Desktop in Applications or start it with: open /Applications/Docker.app"
    else
        log_success "Docker is running"
    fi
}

# Install global npm packages
install_global_packages() {
    log_info "Installing global npm packages..."
    
    local packages=(
        "aws-cdk"
        "typescript"
    )
    
    for package in "${packages[@]}"; do
        log_info "Installing ${package} globally..."
        npm install -g "${package}"
        log_success "${package} installed globally"
    done
}

# Configure AWS CLI
setup_aws_cli() {
    log_info "Checking AWS CLI configuration..."
    
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        log_warning "AWS CLI is not configured or credentials are invalid"
        log_info "Please run the following command to configure AWS CLI:"
        echo ""
        echo "  aws configure"
        echo ""
        log_info "You will need:"
        echo "  - AWS Access Key ID"
        echo "  - AWS Secret Access Key"
        echo "  - Default region (e.g., us-west-2)"
        echo "  - Output format (json)"
        echo ""
        log_info "You can also set up AWS SSO if preferred:"
        echo "  aws configure sso"
        echo ""
    else
        local account_id
        account_id=$(aws sts get-caller-identity --query Account --output text)
        local region
        region=$(aws configure get region || echo "default")
        log_success "AWS CLI is configured (Account: ${account_id}, Region: ${region})"
    fi
}

# Install project dependencies
install_project_dependencies() {
    log_info "Installing project dependencies..."
    
    if [[ ! -f "package.json" ]]; then
        log_error "package.json not found. Make sure you're in the project root directory."
        exit 1
    fi
    
    npm install
    log_success "Project dependencies installed"
    
    log_info "Building project..."
    npm run build
    log_success "Project built successfully"
}

# Bootstrap CDK
bootstrap_cdk() {
    log_info "Checking CDK bootstrap status..."
    
    if aws sts get-caller-identity >/dev/null 2>&1; then
        local account_id
        account_id=$(aws sts get-caller-identity --query Account --output text)
        local region
        region=$(aws configure get region || echo "us-west-2")
        
        log_info "Bootstrapping CDK for account ${account_id} in region ${region}..."
        log_warning "This is required once per AWS account/region combination"
        
        if cdk bootstrap; then
            log_success "CDK bootstrap completed"
        else
            log_warning "CDK bootstrap failed. You may need to run this manually later:"
            echo "  cdk bootstrap"
        fi
    else
        log_warning "AWS CLI not configured. Skipping CDK bootstrap."
        log_info "Run 'aws configure' first, then run 'cdk bootstrap' manually"
    fi
}

# Verify installation
verify_installation() {
    log_info "Verifying installation..."
    echo ""
    
    # Check Node.js
    if command_exists node; then
        local node_version
        node_version=$(node --version)
        log_success "Node.js: ${node_version}"
    else
        log_error "Node.js not found"
    fi
    
    # Check npm
    if command_exists npm; then
        local npm_version
        npm_version=$(npm --version)
        log_success "npm: v${npm_version}"
    else
        log_error "npm not found"
    fi
    
    # Check AWS CLI
    if command_exists aws; then
        local aws_version
        aws_version=$(aws --version | cut -d' ' -f1)
        log_success "AWS CLI: ${aws_version}"
    else
        log_error "AWS CLI not found"
    fi
    
    # Check CDK
    if command_exists cdk; then
        local cdk_version
        cdk_version=$(cdk --version)
        log_success "AWS CDK: ${cdk_version}"
    else
        log_error "AWS CDK not found"
    fi
    
    # Check TypeScript
    if command_exists tsc; then
        local ts_version
        ts_version=$(tsc --version)
        log_success "TypeScript: ${ts_version}"
    else
        log_error "TypeScript not found"
    fi
    
    # Check Docker
    if command_exists docker; then
        if docker info >/dev/null 2>&1; then
            local docker_version
            docker_version=$(docker --version)
            log_success "Docker: ${docker_version} (running)"
        else
            log_warning "Docker installed but not running"
        fi
    else
        log_error "Docker not found"
    fi
    
    # Check optional tools
    if command_exists jq; then
        local jq_version
        jq_version=$(jq --version)
        log_success "jq: $jq_version"
    else
        log_warning "jq not found (optional)"
    fi
    
    if command_exists bc; then
        log_success "bc: installed"
    else
        log_warning "bc not found (optional)"
    fi
}

# Show next steps
show_next_steps() {
    echo ""
    log_success "Setup completed! 🎉"
    echo ""
    log_info "Next steps:"
    echo ""
    echo "1. Configure AWS CLI if not done already:"
    echo "   aws configure"
    echo ""
    echo "2. Deploy to LocalStack (for development):"
    echo "   npm run deploy:localstack"
    echo ""
    echo "3. Deploy to AWS (for production):"
    echo "   npm run deploy:aws"
    echo ""
    echo "4. Run tests:"
    echo "   npm run test:ci           # All tests"
    echo "   npm run test:integration  # Integration tests"
    echo "   npm run test:contract     # Contract tests"
    echo ""
    echo "5. Generate SLOC report:"
    echo "   ./scripts/generate-sloc-report.sh"
    echo ""
    log_info "For detailed documentation, see README.md"
}

# Main execution
main() {
    # Check if we're on macOS
    if [[ "$OSTYPE" != "darwin"* ]]; then
        log_error "This script is designed for macOS. For other platforms, see README.md"
        exit 1
    fi
    
    # Run setup steps
    check_homebrew
    install_system_dependencies
    install_global_packages
    setup_aws_cli
    install_project_dependencies
    bootstrap_cdk
    verify_installation
    show_next_steps
}

# Run main function
main "$@"
