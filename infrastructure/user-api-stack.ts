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
  private readonly isLocalStack: boolean;
  private readonly usersTable: dynamodb.Table;
  private readonly lambdaRole: iam.Role;
  private readonly apiLogGroup: logs.LogGroup;

  constructor(scope: Construct, id: string, props?: UserApiStackProps) {
    super(scope, id, props);

    this.isLocalStack = props?.isLocalStack || false;
    const envSuffix = this.isLocalStack ? '-local' : '';

    // Initialize core resources
    this.apiLogGroup = this.createLogGroup(envSuffix);
    this.usersTable = this.createUsersTable();
    this.lambdaRole = this.createLambdaRole();

    // Create Lambda functions
    const createUserFunction = this.createUserLambdaFunction('CreateUserFunction', 'create-user.ts');
    const getUserFunction = this.createUserLambdaFunction('GetUserFunction', 'get-user.ts');
    const deleteUserFunction = this.createUserLambdaFunction('DeleteUserFunction', 'delete-user.ts');
    const healthFunction = this.createHealthLambdaFunction();

    // Create API Gateway
    const api = this.createApiGateway();
    this.setupApiRoutes(api, {
      createUserFunction,
      getUserFunction,
      deleteUserFunction,
      healthFunction,
    });

    // Create monitoring dashboard
    this.createMonitoringDashboard(api, {
      createUserFunction,
      getUserFunction,
      deleteUserFunction,
      healthFunction,
    });

    // Create outputs
    this.createOutputs(api, { createUserFunction, getUserFunction, deleteUserFunction });
  }

  private createLogGroup(envSuffix: string): logs.LogGroup {
    return new logs.LogGroup(this, 'UserApiLogGroup', {
      logGroupName: `/aws/lambda/user-api${envSuffix}`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
  }

  private createUsersTable(): dynamodb.Table {
    return new dynamodb.Table(this, 'UsersTable', {
      tableName: 'users-table',
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: false,
      },
    });
  }

  private createLambdaRole(): iam.Role {
    return new iam.Role(this, 'UserApiLambdaRole', {
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
              resources: [this.usersTable.tableArn],
            }),
          ],
        }),
      },
    });
  }

  private createBaseEnvironment(): Record<string, string> {
    return {
      LOG_LEVEL: this.isLocalStack ? 'DEBUG' : 'INFO',
      DYNAMODB_TABLE_NAME: this.usersTable.tableName,
      ...(this.isLocalStack && {
        AWS_ENDPOINT_URL: 'http://host.docker.internal:4566',
        DYNAMODB_ENDPOINT: 'http://host.docker.internal:4566',
      }),
    };
  }

  private createBaseBundlingOptions(): any {
    return {
      externalModules: [],
      minify: true,
      sourceMap: false,
      nodeModules: ['@aws-sdk/client-dynamodb', '@aws-sdk/lib-dynamodb'],
      target: 'node20',
    };
  }

  private createUserLambdaFunction(constructId: string, entryFile: string): NodejsFunction {
    return new NodejsFunction(this, constructId, {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: `src/lambda/${entryFile}`,
      role: this.lambdaRole,
      environment: this.createBaseEnvironment(),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      logGroup: this.apiLogGroup,
      bundling: this.createBaseBundlingOptions(),
    });
  }

  private createHealthLambdaFunction(): NodejsFunction {
    return new NodejsFunction(this, 'HealthFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: 'src/lambda/health.ts',
      role: this.lambdaRole,
      environment: {
        LOG_LEVEL: this.isLocalStack ? 'DEBUG' : 'INFO',
      },
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      logGroup: this.apiLogGroup,
      bundling: {
        externalModules: [],
        minify: true,
        sourceMap: false,
        target: 'node20',
      },
    });
  }

  private createApiGateway(): apigateway.RestApi {
    return new apigateway.RestApi(this, 'UserApi', {
      restApiName: 'User Management API',
      description: 'API for managing users with DynamoDB persistence',
      deployOptions: {
        stageName: 'prod',
        accessLogDestination: new apigateway.LogGroupLogDestination(this.apiLogGroup),
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
  }

  private setupApiRoutes(
    api: apigateway.RestApi,
    functions: {
      createUserFunction: NodejsFunction;
      getUserFunction: NodejsFunction;
      deleteUserFunction: NodejsFunction;
      healthFunction: NodejsFunction;
    }
  ): void {
    // Health check endpoint
    const healthResource = api.root.addResource('health');
    healthResource.addMethod('GET', new apigateway.LambdaIntegration(functions.healthFunction));

    // Users resource
    const usersResource = api.root.addResource('users');

    // POST /users - Create user
    usersResource.addMethod('POST', new apigateway.LambdaIntegration(functions.createUserFunction), {
      requestValidatorOptions: {
        validateRequestBody: true,
        validateRequestParameters: false,
      },
    });

    // User by ID resource
    const userResource = usersResource.addResource('{id}');
    userResource.addMethod('GET', new apigateway.LambdaIntegration(functions.getUserFunction));
    userResource.addMethod('DELETE', new apigateway.LambdaIntegration(functions.deleteUserFunction));
  }

  private createMonitoringDashboard(
    api: apigateway.RestApi,
    functions: {
      createUserFunction: NodejsFunction;
      getUserFunction: NodejsFunction;
      deleteUserFunction: NodejsFunction;
      healthFunction: NodejsFunction;
    }
  ): void {
    const dashboard = new cdk.aws_cloudwatch.Dashboard(this, 'UserApiDashboard', {
      dashboardName: 'UserAPI-Monitoring',
    });

    const { createUserFunction, getUserFunction, deleteUserFunction, healthFunction } = functions;

    // Lambda metrics widgets
    dashboard.addWidgets(
      new cdk.aws_cloudwatch.GraphWidget({
        title: 'Lambda Invocations',
        left: [
          createUserFunction.metricInvocations(),
          getUserFunction.metricInvocations(),
          deleteUserFunction.metricInvocations(),
          healthFunction.metricInvocations(),
        ],
      }),
      new cdk.aws_cloudwatch.GraphWidget({
        title: 'Lambda Errors',
        left: [
          createUserFunction.metricErrors(),
          getUserFunction.metricErrors(),
          deleteUserFunction.metricErrors(),
          healthFunction.metricErrors(),
        ],
      }),
      new cdk.aws_cloudwatch.GraphWidget({
        title: 'Lambda Duration',
        left: [
          createUserFunction.metricDuration(),
          getUserFunction.metricDuration(),
          deleteUserFunction.metricDuration(),
          healthFunction.metricDuration(),
        ],
      })
    );

    // API Gateway metrics widgets
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
  }

  private createOutputs(
    api: apigateway.RestApi,
    functions: {
      createUserFunction: NodejsFunction;
      getUserFunction: NodejsFunction;
      deleteUserFunction: NodejsFunction;
    }
  ): void {
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'User API Gateway URL',
    });

    new cdk.CfnOutput(this, 'CreateUserFunctionName', {
      value: functions.createUserFunction.functionName,
      description: 'Create User Lambda Function Name',
    });

    new cdk.CfnOutput(this, 'GetUserFunctionName', {
      value: functions.getUserFunction.functionName,
      description: 'Get User Lambda Function Name',
    });

    new cdk.CfnOutput(this, 'DeleteUserFunctionName', {
      value: functions.deleteUserFunction.functionName,
      description: 'Delete User Lambda Function Name',
    });

    new cdk.CfnOutput(this, 'DynamoDbTableName', {
      value: this.usersTable.tableName,
      description: 'DynamoDB Users Table Name',
    });
  }
}
