# AWS Serverless User API

A TypeScript-based serverless REST API built with AWS CDK, Lambda functions, API Gateway, and DynamoDB for user management.

## 🎯 Features

- **RESTful API**: Create and retrieve users
- **Serverless Architecture**: AWS Lambda functions for scalability
- **DynamoDB Persistence**: NoSQL database for user data storage
- **TypeScript**: Full type safety with Effect library for functional programming
- **AWS CDK**: Infrastructure as Code for consistent deployments
- **Monitoring**: CloudWatch dashboards and logging
- **LocalStack Support**: Local development environment

## 🏗️ Architecture

```
API Gateway → Lambda Functions → DynamoDB
     ↓              ↓              ↓
   REST API    Business Logic   Data Storage
```

### Components

- **API Gateway**: REST API endpoints with CORS support
- **Lambda Functions**: 
  - `CreateUserFunction`: Handles POST /users
  - `GetUserFunction`: Handles GET /users/{id}
- **DynamoDB Table**: `users-table` with user data persistence
- **CloudWatch**: Monitoring dashboard and log aggregation

## 🚀 Quick Start

### Prerequisites

**Essential Tools:**
- **Node.js 20+** - Runtime environment
- **npm** - Package manager (included with Node.js)
- **AWS CLI** - AWS service interaction
- **AWS CDK CLI** - Infrastructure deployment (`npm install -g aws-cdk`)
- **TypeScript** - Project compilation (`npm install -g typescript`)

**For Local Development:**
- **Docker & Docker Compose v2** - LocalStack container runtime

**Optional Tools (Enhanced Experience):**
- **jq** - JSON processing for enhanced test output
- **bc** - Mathematical calculations in SLOC analysis
- **curl** - HTTP testing (usually pre-installed)

### Environment Configuration

1. **Copy environment template:**
   ```bash
   cp .env.example .env
   ```

2. **Configure API key:**
   ```bash
   # Generate a secure API key
   openssl rand -base64 32
   
   # Add to .env file
   echo "API_KEY=your-generated-key-here" >> .env
   ```

3. **Update allowed origins** (for production):
   ```bash
   echo "PROD_ALLOWED_ORIGINS=https://yourdomain.com" >> .env
   ```

📚 **See [Environment Configuration Guide](docs/ENVIRONMENT.md) for detailed setup instructions.**

### 🍎 Automated macOS Setup

For macOS users, we provide a complete automated setup script:

```bash
# Clone the repository
git clone <repository-url>
cd aws-test

# Run automated setup (installs all dependencies)
./scripts/macOS-setup.sh
```

The setup script will:
- ✅ Install Homebrew (if needed)
- ✅ Install Node.js 20, AWS CLI, Docker, and optional tools
- ✅ Install global npm packages (CDK, TypeScript)
- ✅ Install project dependencies
- ✅ Build the project
- ✅ Bootstrap CDK (if AWS is configured)
- ✅ Verify all installations

### 🐧 Manual Setup (Linux/Windows)

**Ubuntu/Debian:**
```bash
# System dependencies
sudo apt-get update
sudo apt-get install nodejs npm awscli docker.io jq bc curl

# Global packages
sudo npm install -g aws-cdk typescript

# Docker setup (includes Docker Compose v2)
sudo systemctl start docker
sudo usermod -aG docker $USER  # Re-login after this
```

**Windows (WSL/Git Bash):**
```bash
# Install Node.js from nodejs.org
# Install AWS CLI from AWS documentation
# Install Docker Desktop from docker.com

# Global packages
npm install -g aws-cdk typescript
```

> **Note**: This project uses Docker Compose v2 (`docker compose` command). Docker Desktop includes Compose v2 by default. On Linux, ensure you have a recent Docker version that includes Compose v2, or install the `docker-compose-plugin` package.

### ⚙️ AWS Configuration

**Required for AWS deployment:**
```bash
# Configure AWS credentials
aws configure
# You'll need:
# - AWS Access Key ID
# - AWS Secret Access Key  
# - Default region (e.g., us-west-2)
# - Output format (json)

# Verify configuration
aws sts get-caller-identity

# Bootstrap CDK (required once per account/region)
cdk bootstrap
```

**AWS IAM Permissions Required:**
- CloudFormation (stack management)
- Lambda (function deployment)
- API Gateway (REST API creation)
- DynamoDB (table operations)
- CloudWatch (monitoring)
- S3 (CDK bootstrap bucket)

### 📦 Project Setup

**After installing prerequisites:**
```bash
# Install project dependencies
npm install

# Build the project
npm run build

# Verify setup
npm run test:unit
```

### Local Development with LocalStack

LocalStack provides a complete AWS emulation environment for development:

```bash
# Start LocalStack with DynamoDB
npm run deploy:localstack

# Verify deployment
npm run test:integration

# Test the LocalStack API
curl -X POST http://localhost:4566/restapis/{api-id}/prod/_user_request_/users \
  -H "Content-Type: application/json" \
  -d '{"id": "user1", "name": "John Doe"}'

# Check LocalStack DynamoDB
aws --endpoint-url=http://localhost:4566 dynamodb scan \
  --table-name users-table --region us-east-1 --no-cli-pager
```

### AWS Deployment

```bash
# Deploy to AWS
npm run deploy:aws

# Run integration tests against AWS
npm run test:deployment

# Test the API (replace with your API Gateway URL)
curl -X POST https://{api-id}.execute-api.us-west-2.amazonaws.com/prod/users \
  -H "Content-Type: application/json" \
  -d '{"id": "user1", "name": "John Doe"}'
```

## � API Documentation

This project includes a comprehensive OpenAPI 3.1.0 specification with interactive documentation.

### View Interactive Documentation
```bash
# Validate the OpenAPI specification
npm run docs:validate

# Serve interactive Swagger UI documentation
npm run docs:serve
# Open http://localhost:8080 in your browser
```

### Generate Client SDKs
```bash
# Generate TypeScript client
npm run docs:generate typescript-axios

# Generate Python client
npm run docs:generate python

# Generate JavaScript client
npm run docs:generate javascript
```

### Documentation Features
- **Complete API Reference**: All endpoints with request/response schemas
- **Interactive Testing**: Try API calls directly from the browser
- **Error Documentation**: Detailed error response formats
- **Multiple Environments**: AWS production and LocalStack development
- **Client Generation**: Generate SDKs for multiple programming languages

See [`docs/README.md`](docs/README.md) for detailed documentation information.

## �📚 API Endpoints

### Create User
```http
POST /users
Content-Type: application/json

{
  "id": "user1",
  "name": "John Doe"
}
```

**Response:**
```json
{
  "id": "user1",
  "name": "John Doe",
  "createdAt": "2025-07-26T01:08:34.747Z",
  "updatedAt": "2025-07-26T01:08:34.747Z"
}
```

### Get User
```http
GET /users/{id}
```

**Response:**
```json
{
  "id": "user1",
  "name": "John Doe",
  "createdAt": "2025-07-26T01:08:34.747Z",
  "updatedAt": "2025-07-26T01:08:34.747Z"
}
```

## 🧪 Testing

This project maintains exceptional test coverage with comprehensive testing strategies:

### Test Coverage Statistics
- **Test-to-Source Ratio**: 7.6:1 (5,099 test SLOC vs 668 source SLOC)
- **Statement Coverage**: 100%
- **Branch Coverage**: 96.15%
- **Total Test Files**: 29 across multiple categories

> **Coverage Configuration**: This project uses Istanbul/nyc for code coverage analysis. When certain code paths cannot be meaningfully tested (e.g., AWS SDK client instantiation, environment-specific configurations), use `/* istanbul ignore next */` comments to exclude them from coverage requirements while maintaining overall quality standards.

### Test Categories
```bash
# Run all tests
npm run test

# CI test suite (comprehensive)
npm run test:ci

# Integration tests
npm run test:integration

# Contract tests (Pact)
npm run test:contract

# Unit tests only
npm run test:unit

# Behavioral tests (Cucumber)
npm run test:behavioral
```

### Automated Deployment Testing
```bash
# Run comprehensive deployment tests
npm run test:all

# Test AWS deployment only
npm run test:deployment

# Test specific components
npm run test:deployment:check    # Health check only
npm run test:deployment:cleanup  # Clean up test data

# Performance testing
npm run test:all:performance
```

### Manual Testing
```bash
# Check deployment status
aws cloudformation describe-stacks --stack-name UserApiStack

# View DynamoDB data
aws dynamodb scan --table-name users-table --no-cli-pager

# Test API endpoints directly
curl -X POST https://{api-id}.execute-api.us-west-2.amazonaws.com/prod/users \
  -H "Content-Type: application/json" \
  -d '{"id":"test1","name":"Test User"}'
```

## 📊 Code Quality & Metrics

### Source Lines of Code (SLOC) Analysis

Generate comprehensive codebase metrics and quality insights:

```bash
# Generate SLOC report
./scripts/generate-sloc-report.sh
```

**Current Project Metrics:**
- **Source Code**: 668 SLOC (10 files) - Core business logic
- **Test Code**: 5,099 SLOC (29 files) - Comprehensive test coverage
- **Infrastructure**: 312 SLOC (2 files) - CDK infrastructure as code
- **Configuration**: 457 SLOC - Project configuration files
- **Total**: 6,592 SLOC with 7.6:1 test-to-source ratio

The SLOC report provides:
- **Detailed breakdown** by file and purpose
- **Architecture distribution** across layers
- **Test coverage analysis** by category
- **Quality insights** and recommendations
- **Technology stack metrics**

*Note: SLOC_REPORT.md is auto-generated and excluded from version control*

## 📈 Monitoring

Access the CloudWatch dashboard: `UserAPI-Monitoring`

Monitor:
- Lambda function invocations and errors
- API Gateway request metrics
- DynamoDB read/write operations

## 🗂️ Project Structure

```
├── src/
│   ├── domain/           # Domain models and schemas (48 SLOC)
│   ├── infrastructure/   # Repository implementations (155 SLOC)
│   ├── services/         # Business logic services
│   └── lambda/           # Lambda function handlers (338 SLOC)
├── infrastructure/       # CDK stack definitions (312 SLOC)
├── test/                # Comprehensive test suite (5,099 SLOC)
│   ├── unit/            # Unit tests
│   ├── integration/     # Integration tests
│   ├── contract/        # Pact contract tests
│   ├── behavioral/      # Cucumber BDD tests
│   ├── utils/           # Test utilities
│   └── setup/           # Test configuration
├── scripts/             # Automation scripts (56 SLOC)
│   ├── generate-sloc-report.sh  # SLOC analysis tool
│   ├── macOS-setup.sh           # Automated macOS environment setup
│   ├── deployment/              # Deployment automation
│   ├── development/             # Development tools
│   └── testing/                 # Test automation
├── archive/             # Archived implementations
│   └── dsql/           # Previous DSQL implementation
└── package.json
```

## 🔧 Technical Stack

- **Runtime**: Node.js 20
- **Language**: TypeScript with Effect library for functional programming
- **Framework**: AWS CDK v2
- **Database**: Amazon DynamoDB
- **Compute**: AWS Lambda
- **API**: Amazon API Gateway
- **Monitoring**: Amazon CloudWatch
- **Local Dev**: LocalStack with Docker
- **Testing**: Jest, Pact (contract testing), Cucumber (BDD)
- **Code Quality**: 100% statement coverage, 7.6:1 test ratio

## 📋 External Dependencies

### Command-Line Tools Required

| Tool | Purpose | Installation | Required |
|------|---------|--------------|----------|
| **Node.js 20+** | Runtime environment | [nodejs.org](https://nodejs.org) | ✅ Essential |
| **npm** | Package manager | Included with Node.js | ✅ Essential |
| **AWS CLI** | AWS service interaction | [AWS Docs](https://docs.aws.amazon.com/cli/) | ✅ Essential |
| **AWS CDK** | Infrastructure deployment | `npm install -g aws-cdk` | ✅ Essential |
| **TypeScript** | Code compilation | `npm install -g typescript` | ✅ Essential |
| **Docker** | LocalStack container | [docker.com](https://docker.com) | 🔧 Development |
| **jq** | JSON processing | `brew install jq` | 📈 Enhanced |
| **bc** | Math calculations | `brew install bc` | 📈 Enhanced |
| **curl** | HTTP testing | Usually pre-installed | 📈 Enhanced |

### Platform-Specific Installation

**macOS (Automated):**
```bash
./scripts/macOS-setup.sh  # Installs everything
```

**macOS (Manual):**
```bash
brew install node@20 awscli docker jq bc
npm install -g aws-cdk typescript
```

**Ubuntu/Debian:**
```bash
sudo apt-get install nodejs npm awscli docker.io jq bc curl
npm install -g aws-cdk typescript
```

**Windows:**
- Install Node.js from [nodejs.org](https://nodejs.org)
- Install AWS CLI from [AWS documentation](https://docs.aws.amazon.com/cli/)
- Install Docker Desktop from [docker.com](https://docker.com)
- Use WSL or Git Bash for shell scripts

### Configuration Requirements

**AWS Credentials (Required for AWS deployment):**
```bash
aws configure  # Interactive setup
# OR
export AWS_ACCESS_KEY_ID="your-key"
export AWS_SECRET_ACCESS_KEY="your-secret"
export AWS_DEFAULT_REGION="us-west-2"
```

**No external config files required** - All configuration is self-contained in the project.

### Troubleshooting Setup Issues

**Docker not running:**
```bash
# macOS
open /Applications/Docker.app

# Linux
sudo systemctl start docker
```

**AWS credentials issues:**
```bash
aws sts get-caller-identity  # Test credentials
aws configure list          # Show current config
```

**Node.js version issues:**
```bash
node --version  # Should be 20+
# Use nvm to manage Node.js versions if needed
```

**CDK bootstrap issues:**
```bash
cdk bootstrap  # Required once per AWS account/region
```

## 📈 Performance

- **Cold Start**: ~300ms
- **Warm Start**: ~50ms
- **DynamoDB**: Sub-10ms read/write latency
- **Auto Scaling**: Lambda scales automatically

## 💰 Cost Optimization

- Pay-per-request DynamoDB billing
- Lambda charged per 100ms execution time
- API Gateway charges per request
- CloudWatch logs with 1-week retention

## 🛠️ Development

### Local Setup
```bash
# Automated setup (macOS)
./scripts/macOS-setup.sh

# Manual setup
npm install
npm run build
npm run deploy:localstack
```

### Development Workflow

**LocalStack Development:**
```bash
# Start LocalStack environment
npm run deploy:localstack

# Run development tests
npm run test:integration

# Check deployment status
npm run deploy:localstack:status

# View logs
docker logs localstack-main

# Teardown when done
npm run deploy:localstack:teardown
```

**Code Quality:**
```bash
# Run all tests
npm run test:ci

# Generate SLOC analysis
./scripts/generate-sloc-report.sh

# Validate scripts
./scripts/validate-scripts.sh
```

### AWS Deployment
```bash
npm run deploy:aws
```

### Teardown
```bash
# LocalStack
npm run localstack:stop

# AWS
./scripts/deploy-aws.sh teardown
```

## 📝 Notes

### DSQL Implementation (Archived)

The project originally used Amazon Aurora DSQL for persistence but encountered connection authorization issues. The DSQL implementation has been archived in `archive/dsql/` and can be restored once the authentication issues are resolved.

**DSQL Issues Encountered:**
- "Access denied" errors despite proper IAM permissions
- Auth token generation working but connection rejected
- Both regular and admin auth tokens attempted

**Migration to DynamoDB:**
- Simplified architecture with native AWS SDK integration
- Immediate functionality and reliability
- Better suited for serverless workloads

### Future Enhancements

- **API Expansion**: Add user update and delete endpoints
- **Enhanced Querying**: Implement user listing with pagination
- **Security**: Add input validation, sanitization, and authentication (Cognito/API Keys)
- **Performance**: Implement caching with ElastiCache
- **CI/CD**: Set up automated testing and deployment pipeline
- **Documentation**: Add comprehensive API documentation with examples
- **Monitoring**: Enhanced observability with custom metrics and alarms

## 🤝 Contributing

### Getting Started
1. **Setup Development Environment:**
   ```bash
   # macOS (automated)
   ./scripts/macOS-setup.sh
   
   # Other platforms - see "External Dependencies" section
   ```

2. **Fork the repository**
3. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

4. **Make your changes**
   - Follow functional programming principles with Effect TypeScript
   - Maintain comprehensive test coverage
   - Add tests for new functionality

5. **Run quality checks**
   ```bash
   npm run test:ci                    # All tests
   ./scripts/generate-sloc-report.sh  # Code metrics
   ./scripts/validate-scripts.sh      # Script validation
   ```

6. **Submit a pull request**

### Development Guidelines
- **Code Style**: TypeScript with Effect library for functional programming
- **Testing**: Maintain 100% statement coverage and 7.6:1+ test ratio
- **Error Handling**: Use Effect's error handling capabilities
- **Documentation**: Update README and inline comments for new features
- **Quality**: Follow the architectural patterns established in the codebase

## 📄 License

This project is licensed under the MIT License.
