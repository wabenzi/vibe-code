#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { UserApiStack } from './user-api-stack';

const app = new cdk.App();

// Determine environment based on CDK context or environment variables
const isLocalStack = 
  process.env.AWS_ENDPOINT_URL?.includes('localhost') || 
  process.env.AWS_ENDPOINT_URL?.includes('4566') ||
  process.env.CDK_DEFAULT_ACCOUNT === '000000000000' ||
  app.node.tryGetContext('localstack') === true;

console.log('🚀 AWS CDK Deployment');
console.log('Environment Detection:');
console.log('- AWS_ENDPOINT_URL:', process.env.AWS_ENDPOINT_URL);
console.log('- CDK_DEFAULT_ACCOUNT:', process.env.CDK_DEFAULT_ACCOUNT);
console.log('- CDK_DEFAULT_REGION:', process.env.CDK_DEFAULT_REGION);
console.log('- Is LocalStack:', isLocalStack);

// Deploy single stack with environment-aware configuration
const stackName = isLocalStack ? 'LocalUserApiStack' : 'UserApiStack';
const stackProps = {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
  isLocalStack,
};

new UserApiStack(app, stackName, stackProps);

console.log(`✅ Deploying ${stackName} to ${isLocalStack ? 'LocalStack' : 'AWS'}`);
