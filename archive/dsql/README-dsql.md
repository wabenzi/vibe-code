# AWS Serverless User Management API

A modern serverless API built with TypeScript, Effect library, AWS Lambda, API Gateway, and DSQL for user management operations.

## Features

- **Functional Programming**: Built with Effect TypeScript for robust error handling and composability
- **Serverless Architecture**: AWS Lambda functions with API Gateway
- **Real DSQL Integration**: PostgreSQL-compatible database operations with AWS authentication
- **Type Safety**: Comprehensive TypeScript coverage with schema validation
- **Monitoring**: CloudWatch integration for observability
- **Infrastructure as Code**: AWS CDK for infrastructure management
- **Fallback Support**: Graceful degradation to mock data when DSQL is unavailable
- **Local Development**: Full LocalStack support for contract testing and local development

## Quick Start

### Local Development
```bash
# Start LocalStack environment
npm run local:start

# Deploy to LocalStack
npm run local:deploy

# Run integration tests
npm run local:test

# Stop environment
npm run local:stop
```

### Production Deployment
```bash
# Deploy to AWS
npm run deploy
```

For detailed instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md) and [LOCALSTACK.md](./LOCALSTACK.md).

## API Endpoints

### Create User
- **POST** `/users`
- **Body**: `{ "id": "string", "name": "string" }`
- **Response**: User object with timestamps

### Get User
- **GET** `/users/{id}`
- **Response**: User object or 404 if not found

## Project Structure

```
├── src/
│   ├── domain/           # Domain models and schemas
│   │   └── user.ts       # User entity and error types
│   ├── services/         # Business logic services
│   │   └── user-service.ts
│   ├── infrastructure/   # Repository implementations
│   │   └── user-repository.ts
│   └── lambda/          # AWS Lambda handlers
│       ├── create-user.ts
│       └── get-user.ts
├── infrastructure/      # CDK infrastructure
│   ├── app.ts
│   └── user-api-stack.ts
├── cdk.json            # CDK configuration
├── tsconfig.json       # TypeScript configuration
└── package.json
```

## Technology Stack

- **Runtime**: Node.js 20.x
- **Language**: TypeScript
- **Framework**: Effect TypeScript
- **Cloud Provider**: AWS
- **Infrastructure**: AWS CDK
- **Database**: AWS DSQL
- **Monitoring**: CloudWatch

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- AWS CLI configured
- AWS CDK CLI installed

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the project:
   ```bash
   npm run build
   ```

3. Bootstrap CDK (first time only):
   ```bash
   npm run bootstrap
   ```

### Deployment

1. Set up DSQL cluster (manual step):
   ```bash
   # Create DSQL cluster in AWS Console
   # Update the DSQL_CLUSTER_ARN environment variable
   ```

2. Deploy the stack:
   ```bash
   npm run deploy
   ```

3. The API Gateway URL will be output after deployment.

### Development

- **Build**: `npm run build`
- **Watch mode**: `npm run watch`
- **Synthesize CDK**: `npm run synth`
- **Check differences**: `npm run diff`
- **Destroy stack**: `npm run destroy`

## Environment Variables

The Lambda functions use the following environment variables:

- `DSQL_CLUSTER_ARN`: ARN of the DSQL cluster
- `DSQL_DATABASE_NAME`: Name of the database (default: "users_db")
- `LOG_LEVEL`: Logging level (default: "INFO")

## Monitoring

The stack includes CloudWatch monitoring with:

- Lambda function metrics (invocations, errors, duration)
- API Gateway metrics (requests, latency, errors)
- Custom dashboard for monitoring

## Error Handling

The application uses Effect TypeScript's error handling capabilities:

- **ValidationError**: Input validation failures
- **UserNotFoundError**: User lookup failures
- **DatabaseError**: Database operation failures

All errors are properly typed and handled at the API level.

## Development Principles

This project follows functional programming principles:

- **Immutability**: All data structures are immutable
- **Composability**: Functions are small and composable
- **Error Handling**: Explicit error handling using Effect
- **Type Safety**: Comprehensive TypeScript coverage
- **Schema Validation**: Runtime type checking with Effect Schema

## Testing

Currently configured for Jest testing framework. Add tests in the `test/` directory.

```bash
npm test
```

## Contributing

1. Follow the functional programming principles outlined in `.github/copilot-instructions.md`
2. Use Effect TypeScript for all business logic
3. Maintain comprehensive TypeScript coverage
4. Add appropriate error handling for all operations
5. Update documentation for any API changes

## License

ISC
