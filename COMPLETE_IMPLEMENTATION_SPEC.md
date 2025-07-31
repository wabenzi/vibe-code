# AWS Serverless User Management API - Generative Specification

## Domain Model

### Core Entity: User
A User represents a person in the system with the following properties:
- **id**: String identifier following pattern `^[a-zA-Z0-9-_]+$`, max 50 characters, non-empty
- **name**: String display name, max 100 characters, non-empty  
- **createdAt**: ISO 8601 timestamp when user was created
- **updatedAt**: ISO 8601 timestamp when user was last modified

### Business Rules
1. **User Identity**: Each user must have a unique ID that cannot be changed after creation
2. **Name Validation**: User names must be non-empty strings that can contain any valid UTF-8 characters
3. **Timestamp Immutability**: createdAt timestamp never changes; updatedAt reflects last modification
4. **Atomic Operations**: User creation and deletion are atomic - either fully succeed or fully fail
5. **Idempotency**: Attempting to create a user with existing ID returns conflict error, not overwrite

### Error Domain
- **ValidationError**: Input data fails validation rules (400 status)
- **UserNotFoundError**: Requested user ID does not exist (404 status)  
- **UserAlreadyExistsError**: Attempt to create user with existing ID (409 status)
- **RepositoryError**: Database operation failure (500 status)

## API Contract

```yaml
# OpenAPI 3.1 Contract Summary
paths:
  /users:
    post:
      summary: Create new user
      request: { id: string, name: string }
      responses:
        201: UserResponse with timestamps
        400: ValidationError
        409: UserAlreadyExistsError
        500: RepositoryError
        
  /users/{id}:
    get:
      summary: Retrieve user by ID
      responses:
        200: UserResponse  
        404: UserNotFoundError
        500: RepositoryError
        
    delete:
      summary: Delete user by ID
      responses:
        204: Success (no content)
        404: UserNotFoundError
        500: RepositoryError
```

## Architecture Constraints

### Infrastructure Pattern: AWS Serverless
- **Compute**: AWS Lambda functions (Node.js 20.x runtime)
- **API Layer**: API Gateway with REST endpoints, CORS enabled
- **Persistence**: DynamoDB table with partition key 'id', pay-per-request billing
- **Security**: IAM roles with least-privilege access to DynamoDB operations
- **Observability**: CloudWatch logs with structured JSON logging

### Technology Stack Requirements
- **Language**: TypeScript with strict type checking
- **Functional Framework**: Effect TypeScript for composition and error handling
- **Schema Validation**: Effect Schema for runtime type validation
- **Infrastructure**: AWS CDK for reproducible deployments
- **Testing**: Jest with custom retry mechanisms for network resilience

### Development Environment
- **Local Development**: LocalStack simulation of AWS services
- **Configuration**: Environment-aware settings (development vs production)
- **Build System**: TypeScript compilation with AWS Lambda bundling
- **Deployment**: CDK stacks for both LocalStack and AWS environments

## Functional Programming Constraints

### Effect Library Usage
- **Service Composition**: Use Effect.gen for async operation chains
- **Error Handling**: Tagged errors with Effect.catchTags for explicit error handling
- **Dependency Injection**: Context.GenericTag for service dependencies
- **Immutability**: Schema.Class for immutable data structures

### Repository Pattern
- Interface defining create, findById, deleteById operations
- Effect-based return types with proper error handling
- DynamoDB implementation with AWS SDK v3
- Environment configuration for LocalStack vs AWS

### Lambda Handler Pattern
- Pure function handlers that compose services
- Input validation before business logic
- Error mapping to appropriate HTTP status codes
- Structured JSON responses with CORS headers

## Testing Strategy Requirements

### Test Categories

#### 1. Unit Tests
- **Domain Model Validation**: Schema.Class validation with Effect Schema testing
- **Service Logic**: Business logic with Effect.provideService for dependency injection
- **Lambda Handler Mocking**: Effect-based mocking of AWS Lambda context and events
- **Error Handling**: Comprehensive testing of tagged error propagation and transformation
- **Pure Function Testing**: Validation of functional composition without side effects

#### 2. Integration Tests  
- **Full API Testing**: End-to-end request/response validation against LocalStack and AWS
- **Database Integration**: DynamoDB operations with real AWS SDK calls
- **Error Scenarios**: Network failures, timeouts, and AWS service errors
- **Performance Validation**: Response time requirements (<5 seconds)
- **Cross-Environment**: Identical test suites running against LocalStack and production AWS

#### 3. Contract Tests
- **OpenAPI Schema Validation**: Request/response schema compliance testing
- **API Versioning**: Backward compatibility validation for API changes
- **Error Response Formats**: Standardized error response structure validation
- **CORS Configuration**: Cross-origin request handling verification

#### 4. Code Quality & Formatting Tests
- **Script Validation**: Shell script syntax and formatting validation
- **TypeScript Compilation**: Zero-error compilation with strict type checking
- **Code Formatting**: Prettier/ESLint compliance for consistent code style
- **Import Organization**: Proper module import structure and unused import detection

### Validation Tools & Scripts

#### Static Analysis Tools
- **trunk**: Code quality and security scanning with auto-fixing capabilities
- **yq**: YAML/JSON validation and manipulation for configuration files
- **swagger-codegen-cli**: OpenAPI specification validation and client generation
- **@apidevtools/swagger-parser**: Runtime OpenAPI schema validation
- **tsc --noEmit**: TypeScript type checking without code generation
- **eslint**: JavaScript/TypeScript linting with custom Effect library rules

#### Script Validation Framework
```bash
# scripts/validate-scripts.sh - Comprehensive validation pipeline
validate_shell_scripts()     # ShellCheck for bash/zsh syntax validation
validate_yaml_configs()      # yq validation for docker compose, CDK configs
validate_json_schemas()      # JSON schema validation for package.json, tsconfig
validate_openapi_spec()      # OpenAPI 3.1 specification compliance
validate_typescript()        # Strict TypeScript compilation
validate_code_formatting()   # Prettier and ESLint compliance
```

#### Testing Infrastructure Validation
- **CDK Synth Testing**: Infrastructure template validation before deployment
- **LocalStack Health Checks**: Container readiness and service availability validation
- **AWS Credentials**: IAM permissions and access validation for CI/CD
- **Environment Configuration**: Configuration drift detection between environments

### Effect Library Testing Patterns

#### Service Mocking with Effect
- **Repository Mocking**: Use Effect.provideService to inject mock implementations that return controlled Effect values
- **Conditional Mock Behavior**: Mock services return different Effects based on input parameters (success for known IDs, failures for invalid ones)
- **Error Simulation**: Mock implementations use Effect.fail with tagged errors to test error handling paths
- **Dependency Composition**: Test programs compose real services with mocked dependencies using Effect's service injection

#### Lambda Context Mocking
- **AWS Context Simulation**: Create mock Lambda context objects with required properties (requestId, functionName, memory limits)
- **Event Object Mocking**: Mock API Gateway events with controlled headers, body content, and path parameters
- **Handler Testing**: Test Lambda handlers in isolation by providing mock context and services without AWS infrastructure
- **Environment Variable Control**: Override environment variables in test context to control handler behavior

#### Error Propagation Testing
- **Tagged Error Chains**: Test that tagged errors propagate correctly through Effect.gen compositions
- **Error Transformation**: Validate that service errors are properly caught and transformed using Effect.catchTags
- **Fallback Behavior**: Test error recovery scenarios where operations continue after catching specific error types
- **Error Mapping**: Verify that domain errors map to appropriate HTTP status codes in handler responses

### Network Resilience Testing

#### Retry Mechanism Validation
- **Exponential Backoff**: Mathematical validation of delay progression
- **Error Classification**: Proper distinction between retryable and non-retryable errors
- **Warning System**: Log aggregation when tests succeed after retries
- **Timeout Configuration**: Environment-specific timeout validation (LocalStack vs AWS)
- **Circuit Breaker**: Fast-fail behavior after consecutive failures

#### Chaos Engineering
- **Network Latency Injection**: Simulated network delays using test doubles
- **Service Unavailability**: Temporary service outage simulation
- **Partial Failure Scenarios**: Mixed success/failure responses in batch operations
- **Resource Exhaustion**: DynamoDB throttling and capacity exceeded scenarios

### Test Environment Management

#### LocalStack Integration
- **Container Lifecycle**: Automated startup, health checks, and cleanup
- **Infrastructure Deployment**: CDK stack deployment validation in containerized environment
- **Service Configuration**: Proper LocalStack service configuration and port mapping
- **Data Isolation**: Test data cleanup and isolation between test runs

#### AWS Production Testing
- **Environment Variable Configuration**: Proper AWS credential and region configuration
- **IAM Role Validation**: Least-privilege access verification
- **Resource Cleanup**: Automated cleanup of test data in production environments
- **Cost Management**: Test execution monitoring to prevent unexpected charges

#### Parallel Execution Constraints
- **Single-Worker Integration Tests**: Prevent database conflicts in integration tests
- **Unit Test Parallelization**: Maximize parallel execution for unit tests
- **Resource Locking**: Test-level resource locking for shared infrastructure
- **Test Isolation**: Proper test data isolation and cleanup strategies

### Quality Gates & Metrics

#### Coverage Requirements
- **Unit Test Coverage**: >95% line coverage for domain models and services
- **Integration Test Coverage**: >90% API endpoint coverage with error scenarios
- **Branch Coverage**: >90% conditional branch coverage for business logic
- **Function Coverage**: 100% function coverage for public API methods

#### Performance Benchmarks
- **Response Time**: <1 second for simple operations, <5 seconds for complex operations
- **Throughput**: Minimum 100 requests/second under normal load
- **Resource Utilization**: Lambda memory usage <80% of allocated memory
- **Cold Start Time**: <3 seconds for Lambda cold start scenarios

#### Security Validation
- **Input Sanitization**: Comprehensive input validation testing
- **SQL Injection Prevention**: NoSQL injection prevention for DynamoDB queries
- **Authentication/Authorization**: Proper IAM role and policy validation
- **Data Encryption**: Encryption at rest and in transit verification

## Implementation Guidance

### File Structure
```text
src/
├── domain/user.ts          # Schema.Class models and tagged errors
├── services/user-service.ts # Business logic with Effect composition
├── infrastructure/user-repository.ts # DynamoDB operations
└── lambda/                 # API Gateway handlers
    ├── create-user.ts
    ├── get-user.ts  
    └── delete-user.ts

infrastructure/
├── app.ts                  # CDK app entry point
├── user-api-stack.ts       # Production infrastructure
└── local-user-api-stack.ts # LocalStack infrastructure

test/
├── unit/                   # Isolated unit tests with mocks
├── integration/            # Full API tests with retry logic
└── utils/                  # Test utilities and retry framework
```

### Key Implementation Patterns

1. **Domain First**: Start with Schema.Class definitions for User and request/response types
2. **Error Types**: Define tagged errors extending Schema.TaggedError for each failure mode  
3. **Service Layer**: Business logic functions using Effect.gen with proper error composition
4. **Repository Interface**: Abstract persistence operations with Effect return types
5. **Lambda Handlers**: Thin wrappers that compose services and map errors to HTTP responses
6. **Infrastructure**: CDK constructs defining DynamoDB table, Lambda functions, and API Gateway

### Quality Gates
- TypeScript compilation with zero errors
- 100% test coverage on domain models and business logic
- All integration tests pass against both LocalStack and AWS
- API contract validation against OpenAPI specification
- Performance requirements met (sub-5 second response times)
- Retry mechanism demonstrably handles network hiccups

This specification provides the minimal set of constraints and patterns needed to generate a functionally equivalent system while maintaining the architectural principles and quality standards of the original implementation.
