<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# AWS Serverless User Management API

This project is an AWS serverless application built with TypeScript using functional programming principles with the Effect library.

## Architecture
- **API Gateway**: RESTful API endpoints
- **AWS Lambda**: Serverless functions for business logic
- **DSQL**: Database for persistence
- **CloudWatch**: Monitoring and observability
- **CDK**: Infrastructure as Code

## Key Principles
- **Functional Programming**: Use Effect TypeScript for all business logic
- **Error Handling**: Leverage Effect's error handling capabilities
- **Type Safety**: Strict TypeScript usage with comprehensive type definitions
- **Immutability**: Prefer immutable data structures
- **Composability**: Build small, composable functions

## Code Style Guidelines
- Use Effect.gen for async operations
- Handle errors explicitly using Effect's error types
- Create domain-specific error types that extend Schema.TaggedError
- Use Schema.Class for data models
- Implement services using functional composition
- Use layers for dependency injection

## File Structure
- `src/domain/`: Domain models and schemas
- `src/services/`: Business logic services using Effect
- `src/infrastructure/`: Repository implementations and external integrations
- `src/lambda/`: AWS Lambda handlers
- `infrastructure/`: CDK infrastructure definitions

When writing code, always consider:
1. Effect composition and error handling
2. Type safety and schema validation
3. Functional programming principles
4. AWS best practices for serverless applications
