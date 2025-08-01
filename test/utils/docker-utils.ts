/**
 * Docker and LocalStack validation utilities for integration tests
 */

import { execSync } from 'child_process';

export interface DockerStatus {
  isRunning: boolean;
  error?: string;
}

export interface LocalStackStatus {
  isRunning: boolean;
  isHealthy: boolean;
  services?: Record<string, string>;
  error?: string;
}

export interface DeploymentStatus {
  isDeployed: boolean;
  version?: string;
  timestamp?: string;
  error?: string;
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  services?: Record<string, any>;
  version?: string;
  deployment?: {
    timestamp?: string;
    buildNumber?: string;
  };
}

/**
 * Check if Docker is running
 */
export const checkDockerStatus = (): DockerStatus => {
  try {
    execSync('docker info', { stdio: 'pipe' });
    return { isRunning: true };
  } catch (error) {
    return {
      isRunning: false,
      error: error instanceof Error ? error.message : 'Unknown Docker error'
    };
  }
};

/**
 * Check if LocalStack is running and healthy
 */
export const checkLocalStackStatus = async (): Promise<LocalStackStatus> => {
  try {
    const response = await fetch('http://localhost:4566/_localstack/health');
    if (!response.ok) {
      return {
        isRunning: true,
        isHealthy: false,
        error: `LocalStack unhealthy: ${response.status} ${response.statusText}`
      };
    }

    const health = await response.json() as HealthResponse;
    return {
      isRunning: true,
      isHealthy: true,
      services: health.services
    };
  } catch (error) {
    return {
      isRunning: false,
      isHealthy: false,
      error: error instanceof Error ? error.message : 'LocalStack connection failed'
    };
  }
};

/**
 * Check if the current code is deployed to LocalStack by checking the health endpoint
 */
export const checkDeploymentStatus = async (apiUrl: string): Promise<DeploymentStatus> => {
  try {
    const response = await fetch(`${apiUrl.replace(/\/$/, '')}/health`);
    if (!response.ok) {
      return {
        isDeployed: false,
        error: `API unhealthy: ${response.status} ${response.statusText}`
      };
    }

    const health = await response.json() as HealthResponse;
    return {
      isDeployed: true,
      version: health.version,
      timestamp: health.deployment?.timestamp
    };
  } catch (error) {
    return {
      isDeployed: false,
      error: error instanceof Error ? error.message : 'API connection failed'
    };
  }
};

/**
 * Comprehensive pre-test validation for integration tests
 */
export const validateIntegrationEnvironment = async (apiUrl: string): Promise<{
  valid: boolean;
  docker: DockerStatus;
  localstack: LocalStackStatus;
  deployment: DeploymentStatus;
  errors: string[];
}> => {
  const errors: string[] = [];
  
  // Check Docker
  const docker = checkDockerStatus();
  if (!docker.isRunning) {
    errors.push(`❌ Docker is not running: ${docker.error}`);
  }

  // Check LocalStack
  const localstack = await checkLocalStackStatus();
  if (!localstack.isRunning) {
    errors.push(`❌ LocalStack is not running: ${localstack.error}`);
  } else if (!localstack.isHealthy) {
    errors.push(`❌ LocalStack is unhealthy: ${localstack.error}`);
  }

  // Check deployment
  const deployment = await checkDeploymentStatus(apiUrl);
  if (!deployment.isDeployed) {
    errors.push(`❌ API not deployed to LocalStack: ${deployment.error}`);
  }

  return {
    valid: errors.length === 0,
    docker,
    localstack,
    deployment,
    errors
  };
};

/**
 * Print a highlighted error message for integration test failures
 */
export const printIntegrationError = (errors: string[]): void => {
  console.error('\n' + '='.repeat(80));
  console.error('🚨 INTEGRATION TEST SETUP FAILURE 🚨');
  console.error('='.repeat(80));
  console.error('\nIntegration tests require the following dependencies:');
  console.error('');
  
  errors.forEach(error => {
    console.error(`  ${error}`);
  });
  
  console.error('\n📋 Required setup steps:');
  console.error('  1. ✅ Ensure Docker is running: open /Applications/Docker.app (macOS)');
  console.error('  2. 🚀 Deploy to LocalStack: npm run deploy:localstack');
  console.error('  3. 🧪 Run integration tests: npm run test:integration');
  console.error('');
  console.error('💡 Alternative: Use automated integration testing:');
  console.error('     npm run test:enterprise  # Handles LocalStack lifecycle automatically');
  console.error('');
  console.error('='.repeat(80) + '\n');
};

/**
 * Get current package version for deployment validation
 */
export const getCurrentVersion = (): string => {
  try {
    const packageJson = require('../../package.json');
    return packageJson.version || '1.0.0';
  } catch {
    return '1.0.0';
  }
};
