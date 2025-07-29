import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';

export interface UserApiStackProps extends cdk.StackProps {
  /**
   * Whether this stack is being deployed to LocalStack.
   * When true, adjusts configuration for local development.
   */
  isLocalStack?: boolean;
}

export class UserApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: UserApiStackProps) {
    super(scope, id, props);

    const isLocalStack = props?.isLocalStack || false;
    const envSuffix = isLocalStack ? '-local' : '';

    // CloudWatch Log Group for monitoring
    const apiLogGroup = new logs.LogGroup(this, 'UserApiLogGroup', {
      logGroupName: `/aws/lambda/user-api${envSuffix}`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // DynamoDB Table for users
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

    // IAM role for Lambda functions to access DynamoDB
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

    // Create User Lambda Function
    const createUserFunction = new NodejsFunction(this, 'CreateUserFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: 'src/lambda/create-user.ts',
      role: lambdaRole,
      environment: {
        LOG_LEVEL: isLocalStack ? 'DEBUG' : 'INFO',
        DYNAMODB_TABLE_NAME: usersTable.tableName,
        ...(isLocalStack && {
          AWS_ENDPOINT_URL: 'http://host.docker.internal:4566',
          DYNAMODB_ENDPOINT: 'http://host.docker.internal:4566',
        }),
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      logGroup: apiLogGroup,
      bundling: {
        // Don't exclude AWS SDK v3 packages - bundle them
        externalModules: [],
        minify: true,
        sourceMap: false,
        // Force bundling of these packages to avoid runtime issues
        nodeModules: ['@aws-sdk/client-dynamodb', '@aws-sdk/lib-dynamodb'],
        target: 'node20',
      },
    });

    // Get User Lambda Function
    const getUserFunction = new NodejsFunction(this, 'GetUserFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: 'src/lambda/get-user.ts',
      role: lambdaRole,
      environment: {
        LOG_LEVEL: isLocalStack ? 'DEBUG' : 'INFO',
        DYNAMODB_TABLE_NAME: usersTable.tableName,
        ...(isLocalStack && {
          AWS_ENDPOINT_URL: 'http://host.docker.internal:4566',
          DYNAMODB_ENDPOINT: 'http://host.docker.internal:4566',
        }),
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      logGroup: apiLogGroup,
      bundling: {
        // Don't exclude AWS SDK v3 packages - bundle them
        externalModules: [],
        minify: true,
        sourceMap: false,
        // Force bundling of these packages to avoid runtime issues
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
      environment: {
        LOG_LEVEL: isLocalStack ? 'DEBUG' : 'INFO',
        DYNAMODB_TABLE_NAME: usersTable.tableName,
        ...(isLocalStack && {
          AWS_ENDPOINT_URL: 'http://host.docker.internal:4566',
          DYNAMODB_ENDPOINT: 'http://host.docker.internal:4566',
        }),
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      logGroup: apiLogGroup,
      bundling: {
        // Don't exclude AWS SDK v3 packages - bundle them
        externalModules: [],
        minify: true,
        sourceMap: false,
        // Force bundling of these packages to avoid runtime issues
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
      environment: {
        LOG_LEVEL: isLocalStack ? 'DEBUG' : 'INFO',
      },
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      logGroup: apiLogGroup,
      bundling: {
        externalModules: [],
        minify: true,
        sourceMap: false,
        target: 'node20',
      },
    });

    // API Gateway
    const api = new apigateway.RestApi(this, 'UserApi', {
      restApiName: 'User Management API',
      description: 'API for managing users with DynamoDB persistence',
      deployOptions: {
        stageName: 'prod',
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

    // Users resource
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

    // CloudWatch Dashboard for monitoring
    const dashboard = new cdk.aws_cloudwatch.Dashboard(this, 'UserApiDashboard', {
      dashboardName: 'UserAPI-Monitoring',
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
      })
    );

    // Add API Gateway metrics
    dashboard.addWidgets(
      new cdk.aws_cloudwatch.GraphWidget({
        title: 'API Gateway Requests',
        left: [api.metricCount()],
      }),
      new cdk.aws_cloudwatch.GraphWidget({
        title: 'API Gateway Latency',
        left: [api.metricLatency()],
      }),
      new cdk.aws_cloudwatch.GraphWidget({
        title: 'API Gateway Errors',
        left: [api.metricClientError(), api.metricServerError()],
      })
    );

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'User API Gateway URL',
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

    new cdk.CfnOutput(this, 'DynamoDbTableName', {
      value: usersTable.tableName,
      description: 'DynamoDB Users Table Name',
    });
  }
}
