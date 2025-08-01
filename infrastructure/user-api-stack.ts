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
    const authorizerFunction = this.createAuthorizerLambdaFunction();
    const createUserFunction = this.createUserLambdaFunction('CreateUserFunction', 'create-user.ts');
    const getUserFunction = this.createUserLambdaFunction('GetUserFunction', 'get-user.ts');
    const deleteUserFunction = this.createUserLambdaFunction('DeleteUserFunction', 'delete-user.ts');
    const healthFunction = this.createHealthLambdaFunction();

    // Create API Gateway with Lambda Authorizer
    const api = this.createApiGateway();
    // Skip authorizer creation for LocalStack due to CloudFormation dependency issues
    const authorizer = this.isLocalStack ? undefined : this.createLambdaAuthorizer(api, authorizerFunction);
    this.setupApiRoutes(api, {
      createUserFunction,
      getUserFunction,
      deleteUserFunction,
      healthFunction,
    }, authorizer);

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
              // Least privilege - only permissions actually used by the application
              actions: [
                'dynamodb:GetItem',    // Used by get-user.ts
                'dynamodb:PutItem',    // Used by create-user.ts  
                'dynamodb:DeleteItem', // Used by delete-user.ts
                // Removed: UpdateItem, Scan, Query (not used by current application)
              ],
              resources: [this.usersTable.tableArn],
              // Add condition for additional security
              conditions: {
                'ForAllValues:StringEquals': {
                  'dynamodb:Attributes': ['id', 'name', 'createdAt', 'updatedAt']
                }
              }
            }),
          ],
        }),
      },
    });
  }

  private createAuthorizerLambdaFunction(): NodejsFunction {
    return new NodejsFunction(this, 'AuthorizerFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: 'src/lambda/authorizer.ts',
      role: this.lambdaRole,
      environment: {
        ...this.createBaseEnvironment(),
        JWT_SECRET: process.env.JWT_SECRET || 'development-secret-key',
        JWT_AUDIENCE: process.env.JWT_AUDIENCE || 'user-management-api',
        JWT_ISSUER: process.env.JWT_ISSUER || 'user-management-service',
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      logGroup: this.apiLogGroup,
      bundling: {
        ...this.createBaseBundlingOptions(),
        nodeModules: [...this.createBaseBundlingOptions().nodeModules, 'jsonwebtoken'],
      },
    });
  }

  private createLambdaAuthorizer(api: apigateway.RestApi, authorizerFunction: NodejsFunction): apigateway.TokenAuthorizer {
    return new apigateway.TokenAuthorizer(this, 'UserApiAuthorizer', {
      authorizerName: 'UserApiTokenAuthorizer',
      handler: authorizerFunction,
      identitySource: 'method.request.header.Authorization',
      validationRegex: '^Bearer [-0-9A-Za-z\\.]+$',
      resultsCacheTtl: cdk.Duration.seconds(300), // Cache authorization results for 5 minutes
    });
  }

  private createBaseEnvironment(): Record<string, string> {
    const jwtSecret = process.env.JWT_SECRET || 'development-secret-key';
    
    // Security warning for production deployments with default JWT secret
    if (!this.isLocalStack && jwtSecret === 'development-secret-key') {
      console.warn('⚠️  WARNING: Using default JWT secret in production! Set JWT_SECRET environment variable.');
    }
    
    return {
      LOG_LEVEL: this.isLocalStack ? 'DEBUG' : 'INFO',
      DYNAMODB_TABLE_NAME: this.usersTable.tableName,
      NODE_ENV: this.isLocalStack ? 'development' : 'production',
      // Security configuration
      SUPPRESS_ERROR_DETAILS: this.isLocalStack ? 'false' : 'true',
      ALLOWED_ORIGINS: this.isLocalStack
        ? 'http://localhost:3000,http://localhost:8080'
        : process.env.PROD_ALLOWED_ORIGINS || 'https://yourdomain.com',
      JWT_SECRET: jwtSecret,
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
    // Create API key for authentication
    const apiKey = new apigateway.ApiKey(this, 'UserApiKey', {
      apiKeyName: `user-api-key-${this.isLocalStack ? 'local' : 'prod'}`,
      description: 'API key for User Management API',
      enabled: true,
    });

    const api = new apigateway.RestApi(this, 'UserApi', {
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
      // Fix CORS security vulnerability - restrict origins
      defaultCorsPreflightOptions: {
        allowOrigins: this.isLocalStack
          ? ['http://localhost:3000', 'http://localhost:8080']
          : [process.env.ALLOWED_ORIGINS || 'https://yourdomain.com'],
        allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key'],
        allowCredentials: true,
      },
    });

    // Create usage plan and associate API key
    const usagePlan = new apigateway.UsagePlan(this, 'UserApiUsagePlan', {
      name: 'UserApiUsagePlan',
      description: 'Usage plan for User Management API',
      apiStages: [{
        api: api,
        stage: api.deploymentStage,
      }],
      // Add rate limiting for security
      throttle: {
        rateLimit: 100,  // requests per second
        burstLimit: 200, // burst capacity
      },
      quota: {
        limit: 10000,    // requests per day
        period: apigateway.Period.DAY,
      },
    });

    usagePlan.addApiKey(apiKey);

    // Output the API key for reference (in non-production environments)
    if (this.isLocalStack) {
      new cdk.CfnOutput(this, 'ApiKeyOutput', {
        value: apiKey.keyId,
        description: 'API Key ID for testing (LocalStack)',
      });
    }

    return api;
  }

  private setupApiRoutes(
    api: apigateway.RestApi,
    functions: {
      createUserFunction: NodejsFunction;
      getUserFunction: NodejsFunction;
      deleteUserFunction: NodejsFunction;
      healthFunction: NodejsFunction;
    },
    authorizer?: apigateway.TokenAuthorizer
  ): void {
    // Health check endpoint (no authentication required for monitoring)
    const healthResource = api.root.addResource('health');
    healthResource.addMethod('GET', new apigateway.LambdaIntegration(functions.healthFunction), {
      authorizationType: apigateway.AuthorizationType.NONE,
    });

    // Users resource (protected endpoints in production, open in LocalStack for testing)
    const usersResource = api.root.addResource('users');

    // POST /users - Create user (requires JWT authorization in production)
    const createUserMethodOptions: apigateway.MethodOptions = authorizer ? {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: authorizer,
      requestValidatorOptions: {
        validateRequestBody: true,
        validateRequestParameters: false,
      },
    } : {
      authorizationType: apigateway.AuthorizationType.NONE,
      requestValidatorOptions: {
        validateRequestBody: true,
        validateRequestParameters: false,
      },
    };
    usersResource.addMethod('POST', new apigateway.LambdaIntegration(functions.createUserFunction), createUserMethodOptions);

    // User by ID resource (protected endpoints in production, open in LocalStack for testing)
    const userResource = usersResource.addResource('{id}');

    const getUserMethodOptions: apigateway.MethodOptions = authorizer ? {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: authorizer,
    } : {
      authorizationType: apigateway.AuthorizationType.NONE,
    };
    userResource.addMethod('GET', new apigateway.LambdaIntegration(functions.getUserFunction), getUserMethodOptions);

    const deleteUserMethodOptions: apigateway.MethodOptions = authorizer ? {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: authorizer,
    } : {
      authorizationType: apigateway.AuthorizationType.NONE,
    };
    userResource.addMethod('DELETE', new apigateway.LambdaIntegration(functions.deleteUserFunction), deleteUserMethodOptions);
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
