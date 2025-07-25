import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';

export class UserApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // CloudWatch Log Group for monitoring
    const apiLogGroup = new logs.LogGroup(this, 'UserApiLogGroup', {
      logGroupName: '/aws/lambda/user-api',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // IAM role for Lambda functions to access DSQL
    const lambdaRole = new iam.Role(this, 'UserApiLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
      inlinePolicies: {
        DSQLAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'dsql:DescribeCluster',
                'dsql:DescribeMultiRegionClusters',
                'dsql:CreateDatabase',
                'dsql:ListDatabases',
                'dsql:DescribeDatabase',
                'dsql:GenerateDbConnectAuthToken',
              ],
              resources: ['*'],
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
        LOG_LEVEL: 'INFO',
        DSQL_CLUSTER_ARN: process.env.DSQL_CLUSTER_ARN || '',
        DSQL_DATABASE_NAME: 'users_db',
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      logGroup: apiLogGroup,
      bundling: {
        externalModules: ['aws-sdk'],
        minify: true,
        sourceMap: false,
      },
    });

    // Get User Lambda Function
    const getUserFunction = new NodejsFunction(this, 'GetUserFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: 'src/lambda/get-user.ts',
      role: lambdaRole,
      environment: {
        LOG_LEVEL: 'INFO',
        DSQL_CLUSTER_ARN: process.env.DSQL_CLUSTER_ARN || '',
        DSQL_DATABASE_NAME: 'users_db',
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      logGroup: apiLogGroup,
      bundling: {
        externalModules: ['aws-sdk'],
        minify: true,
        sourceMap: false,
      },
    });

    // API Gateway
    const api = new apigateway.RestApi(this, 'UserApi', {
      restApiName: 'User Management API',
      description: 'API for managing users with DSQL persistence',
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

    // CloudWatch Dashboard for monitoring
    const dashboard = new cdk.aws_cloudwatch.Dashboard(this, 'UserApiDashboard', {
      dashboardName: 'UserAPI-Monitoring',
    });

    // Add Lambda metrics widgets
    dashboard.addWidgets(
      new cdk.aws_cloudwatch.GraphWidget({
        title: 'Lambda Invocations',
        left: [createUserFunction.metricInvocations(), getUserFunction.metricInvocations()],
      }),
      new cdk.aws_cloudwatch.GraphWidget({
        title: 'Lambda Errors',
        left: [createUserFunction.metricErrors(), getUserFunction.metricErrors()],
      }),
      new cdk.aws_cloudwatch.GraphWidget({
        title: 'Lambda Duration',
        left: [createUserFunction.metricDuration(), getUserFunction.metricDuration()],
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
  }
}
