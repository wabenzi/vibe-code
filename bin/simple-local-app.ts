#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { SimpleLocalUserApiStack } from '../infrastructure/simple-local-stack';

// Environment check
const isLocalStack = process.env.AWS_ENDPOINT_URL?.includes('localhost') || false;
console.log('Environment check:');
console.log('AWS_ENDPOINT_URL:', process.env.AWS_ENDPOINT_URL);
console.log('CDK_DEFAULT_ACCOUNT:', process.env.CDK_DEFAULT_ACCOUNT);
console.log('Is LocalStack:', isLocalStack);

if (isLocalStack) {
  console.log('🚀 Deploying simple stack to LocalStack environment');
} else {
  console.log('⚠️  Not deploying - LocalStack environment not detected');
  process.exit(1);
}

const app = new cdk.App();

new SimpleLocalUserApiStack(app, 'SimpleLocalUserApiStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT || '000000000000',
    region: process.env.CDK_DEFAULT_REGION || 'us-west-2',
  },
});
