import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';

export class LocalUserApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // CloudWatch Log Group for monitoring
    const apiLogGroup = new logs.LogGroup(this, 'UserApiLogGroup', {
      logGroupName: '/aws/lambda/user-api-local',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // DynamoDB Table for users (same as AWS version)
    const usersTable = new dynamodb.Table(this, 'UsersTable', {
      tableName: 'users-table',
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: false,
    });

    // IAM role for Lambda functions to access DynamoDB (same as AWS version)
    const lambdaRole = new iam.Role(this, 'UserApiLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
      inlinePolicies: {
        DynamoDBAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'dynamodb:GetItem',
                'dynamodb:PutItem',
                'dynamodb:UpdateItem',
                'dynamodb:DeleteItem',
                'dynamodb:Scan',
                'dynamodb:Query',
              ],
              resources: [usersTable.tableArn],
            }),
          ],
        }),
      },
    });

    // Environment variables for LocalStack - let AWS SDK use default configuration
    const localEnvironment = {
      LOG_LEVEL: 'DEBUG', // More verbose logging for local development
      DYNAMODB_TABLE_NAME: usersTable.tableName,
      // Note: Don't set DYNAMODB_ENDPOINT - let LocalStack intercept AWS SDK calls automatically
    };

    // Create User Lambda Function (same code as AWS, just different environment)
    const createUserFunction = new NodejsFunction(this, 'CreateUserFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: 'src/lambda/create-user.ts', // Use the same AWS Lambda code
      role: lambdaRole,
      environment: localEnvironment,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      logGroup: apiLogGroup,
      bundling: {
        // Same bundling config as AWS version
        externalModules: [],
        minify: false, // Don't minify for easier debugging in local
        sourceMap: true, // Include source maps for local debugging
        nodeModules: ['@aws-sdk/client-dynamodb', '@aws-sdk/lib-dynamodb'],
        target: 'node20',
      },
    });

    // Get User Lambda Function (same code as AWS, just different environment)
    const getUserFunction = new NodejsFunction(this, 'GetUserFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: 'src/lambda/get-user.ts', // Use the same AWS Lambda code
      role: lambdaRole,
      environment: localEnvironment,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      logGroup: apiLogGroup,
      bundling: {
        // Same bundling config as AWS version
        externalModules: [],
        minify: false, // Don't minify for easier debugging in local
        sourceMap: true, // Include source maps for local debugging
        nodeModules: ['@aws-sdk/client-dynamodb', '@aws-sdk/lib-dynamodb'],
        target: 'node20',
      },
    });

    // Delete User Lambda Function
    const deleteUserFunction = new NodejsFunction(this, 'DeleteUserFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: 'src/lambda/delete-user.ts',
      role: lambdaRole,
      environment: localEnvironment,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      logGroup: apiLogGroup,
      bundling: {
        // Same bundling config as AWS version
        externalModules: [],
        minify: false, // Don't minify for easier debugging in local
        sourceMap: true, // Include source maps for local debugging
        nodeModules: ['@aws-sdk/client-dynamodb', '@aws-sdk/lib-dynamodb'],
        target: 'node20',
      },
    });

    // Health Check Lambda Function (for CI/CD and monitoring)
    const healthFunction = new NodejsFunction(this, 'HealthFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: 'src/lambda/health.ts',
      role: lambdaRole,
      environment: localEnvironment,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      logGroup: apiLogGroup,
      bundling: {
        externalModules: [],
        minify: false,
        sourceMap: true,
        target: 'node20',
      },
    });

    // API Gateway (same structure as AWS version)
    const api = new apigateway.RestApi(this, 'UserApi', {
      restApiName: 'User Management API (LocalStack)',
      description: 'API for managing users with DynamoDB persistence - LocalStack version',
      deployOptions: {
        stageName: 'local',
        accessLogDestination: new apigateway.LogGroupLogDestination(apiLogGroup),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields(),
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key'],
      },
    });

    // Users resource (same as AWS version)
    const usersResource = api.root.addResource('users');

    // GET /health - Health check endpoint
    const healthResource = api.root.addResource('health');
    healthResource.addMethod('GET', new apigateway.LambdaIntegration(healthFunction));

    // POST /users - Create user
    usersResource.addMethod('POST', new apigateway.LambdaIntegration(createUserFunction), {
      requestValidatorOptions: {
        validateRequestBody: true,
        validateRequestParameters: false,
      },
    });

    // GET /users/{id} - Get user by ID
    const userResource = usersResource.addResource('{id}');
    userResource.addMethod('GET', new apigateway.LambdaIntegration(getUserFunction));

    // DELETE /users/{id} - Delete user by ID
    userResource.addMethod('DELETE', new apigateway.LambdaIntegration(deleteUserFunction));

    // CloudWatch Dashboard for monitoring (same as AWS version)
    const dashboard = new cdk.aws_cloudwatch.Dashboard(this, 'UserApiDashboard', {
      dashboardName: 'UserAPI-LocalStack-Monitoring',
    });

    // Add Lambda metrics widgets
    dashboard.addWidgets(
      new cdk.aws_cloudwatch.GraphWidget({
        title: 'Lambda Invocations',
        left: [createUserFunction.metricInvocations(), getUserFunction.metricInvocations(), deleteUserFunction.metricInvocations(), healthFunction.metricInvocations()],
      }),
      new cdk.aws_cloudwatch.GraphWidget({
        title: 'Lambda Errors',
        left: [createUserFunction.metricErrors(), getUserFunction.metricErrors(), deleteUserFunction.metricErrors(), healthFunction.metricErrors()],
      }),
      new cdk.aws_cloudwatch.GraphWidget({
        title: 'Lambda Duration',
        left: [createUserFunction.metricDuration(), getUserFunction.metricDuration(), deleteUserFunction.metricDuration(), healthFunction.metricDuration()],
      }),
      new cdk.aws_cloudwatch.GraphWidget({
        title: 'API Gateway Requests',
        left: [
          new cdk.aws_cloudwatch.Metric({
            namespace: 'AWS/ApiGateway',
            metricName: 'Count',
            dimensionsMap: {
              ApiName: api.restApiName,
            },
          }),
        ],
      }),
      new cdk.aws_cloudwatch.GraphWidget({
        title: 'DynamoDB Operations',
        left: [
          new cdk.aws_cloudwatch.Metric({
            namespace: 'AWS/DynamoDB',
            metricName: 'ConsumedReadCapacityUnits',
            dimensionsMap: {
              TableName: usersTable.tableName,
            },
          }),
          new cdk.aws_cloudwatch.Metric({
            namespace: 'AWS/DynamoDB',
            metricName: 'ConsumedWriteCapacityUnits',
            dimensionsMap: {
              TableName: usersTable.tableName,
            },
          }),
        ],
      })
    );

    // Output values for testing (same as AWS version but with local context)
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'User API Gateway URL for LocalStack',
    });

    new cdk.CfnOutput(this, 'DynamoDbTableName', {
      value: usersTable.tableName,
      description: 'DynamoDB Users Table Name',
    });

    new cdk.CfnOutput(this, 'CreateUserFunctionName', {
      value: createUserFunction.functionName,
      description: 'Create User Lambda Function Name',
    });

    new cdk.CfnOutput(this, 'GetUserFunctionName', {
      value: getUserFunction.functionName,
      description: 'Get User Lambda Function Name',
    });

    new cdk.CfnOutput(this, 'DeleteUserFunctionName', {
      value: deleteUserFunction.functionName,
      description: 'Delete User Lambda Function Name',
    });
  }
}
