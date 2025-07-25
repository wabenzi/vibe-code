import { Stack, StackProps, Duration } from 'aws-cdk-lib'
import { Runtime } from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import { RestApi, LambdaIntegration, Cors } from 'aws-cdk-lib/aws-apigateway'
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs'
import { Dashboard, GraphWidget, Metric } from 'aws-cdk-lib/aws-cloudwatch'
import { Construct } from 'constructs'
import * as path from 'path'

export class LocalUserApiStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    // Environment variables for local development
    const environment = {
      NODE_ENV: 'local',
      POSTGRES_HOST: process.env.POSTGRES_HOST || 'host.docker.internal',
      POSTGRES_PORT: process.env.POSTGRES_PORT || '5432',
      POSTGRES_DB: process.env.POSTGRES_DB || 'users_db',
      POSTGRES_USER: process.env.POSTGRES_USER || 'testuser',
      POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD || 'testpass',
      LOG_LEVEL: 'DEBUG'
    }

    // Create Lambda functions for local testing
    const createUserFunction = new NodejsFunction(this, 'CreateUserFunction', {
      entry: path.join(__dirname, '../src/lambda/create-user-local.ts'),
      handler: 'handler',
      runtime: Runtime.NODEJS_20_X,
      timeout: Duration.seconds(30),
      environment,
      bundling: {
        minify: false,
        sourceMap: true,
        target: 'es2020',
        keepNames: true,
        externalModules: ['pg-native']
      }
    })

    const getUserFunction = new NodejsFunction(this, 'GetUserFunction', {
      entry: path.join(__dirname, '../src/lambda/get-user-local.ts'),
      handler: 'handler',
      runtime: Runtime.NODEJS_20_X,
      timeout: Duration.seconds(30),
      environment,
      bundling: {
        minify: false,
        sourceMap: true,
        target: 'es2020',
        keepNames: true,
        externalModules: ['pg-native']
      }
    })

    // Create CloudWatch Log Groups
    new LogGroup(this, 'CreateUserLogGroup', {
      logGroupName: `/aws/lambda/${createUserFunction.functionName}`,
      retention: RetentionDays.ONE_WEEK
    })

    new LogGroup(this, 'GetUserLogGroup', {
      logGroupName: `/aws/lambda/${getUserFunction.functionName}`,
      retention: RetentionDays.ONE_WEEK
    })

    // Create API Gateway
    const api = new RestApi(this, 'UserApi', {
      restApiName: 'User Management API (Local)',
      description: 'Local development API for user management with LocalStack',
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
        allowMethods: Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key']
      }
    })

    // Create API routes
    const users = api.root.addResource('users')
    
    // POST /users
    users.addMethod('POST', new LambdaIntegration(createUserFunction))
    
    // GET /users/{id}
    const userById = users.addResource('{id}')
    userById.addMethod('GET', new LambdaIntegration(getUserFunction))

    // Create monitoring dashboard for local development
    const dashboard = new Dashboard(this, 'LocalUserApiDashboard', {
      dashboardName: 'LocalUserAPI-Monitoring'
    })

    // Add metrics widgets
    dashboard.addWidgets(
      new GraphWidget({
        title: 'Lambda Invocations',
        left: [
          createUserFunction.metricInvocations(),
          getUserFunction.metricInvocations()
        ]
      }),
      new GraphWidget({
        title: 'Lambda Errors',
        left: [
          createUserFunction.metricErrors(),
          getUserFunction.metricErrors()
        ]
      }),
      new GraphWidget({
        title: 'Lambda Duration',
        left: [
          createUserFunction.metricDuration(),
          getUserFunction.metricDuration()
        ]
      }),
      new GraphWidget({
        title: 'API Gateway Requests',
        left: [
          new Metric({
            namespace: 'AWS/ApiGateway',
            metricName: 'Count',
            dimensionsMap: {
              ApiName: api.restApiName
            }
          })
        ]
      })
    )
  }
}
