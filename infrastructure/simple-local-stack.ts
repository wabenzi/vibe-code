import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';
import * as path from 'path';

export class SimpleLocalUserApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Simple Lambda function with inline code for testing
    const createUserFunction = new lambda.Function(this, 'CreateUserFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
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
      `),
      environment: {
        LOG_LEVEL: 'DEBUG'
      }
    });

    const getUserFunction = new lambda.Function(this, 'GetUserFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
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
      `),
      environment: {
        LOG_LEVEL: 'DEBUG'
      }
    });

    // Create API Gateway
    const api = new apigateway.RestApi(this, 'UserApi', {
      restApiName: 'User Service (Local)',
      description: 'Simple user management API for LocalStack testing',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-Amz-Security-Token'],
      },
    });

    // Add resources and methods
    const users = api.root.addResource('users');
    users.addMethod('POST', new apigateway.LambdaIntegration(createUserFunction));

    const user = users.addResource('{id}');
    user.addMethod('GET', new apigateway.LambdaIntegration(getUserFunction));

    // Output the API endpoint
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: api.url,
      description: 'API Gateway endpoint URL',
    });
  }
}
