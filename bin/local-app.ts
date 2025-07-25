#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
import { UserApiStack } from '../infrastructure/user-api-stack'
import { LocalUserApiStack } from '../infrastructure/local-user-api-stack'

const app = new cdk.App()

// Determine if we're deploying to LocalStack based on environment
const isLocalStack = process.env.AWS_ENDPOINT_URL?.includes('localhost') || 
                    process.env.AWS_ENDPOINT_URL?.includes('4566') ||
                    process.env.CDK_DEFAULT_ACCOUNT === '000000000000'

console.log('Environment check:')
console.log('AWS_ENDPOINT_URL:', process.env.AWS_ENDPOINT_URL)
console.log('CDK_DEFAULT_ACCOUNT:', process.env.CDK_DEFAULT_ACCOUNT)
console.log('Is LocalStack:', isLocalStack)

if (isLocalStack) {
  // Deploy local stack for LocalStack
  new LocalUserApiStack(app, 'LocalUserApiStack', {
    env: {
      account: '000000000000',
      region: process.env.CDK_DEFAULT_REGION || 'us-west-2'
    }
  })
  console.log('🚀 Deploying to LocalStack environment')
} else {
  // Deploy production stack for AWS
  new UserApiStack(app, 'UserApiStack', {
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION || 'us-west-2'
    }
  })
  console.log('☁️ Deploying to AWS environment')
}
