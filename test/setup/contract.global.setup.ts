import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export default async function contractGlobalSetup() {
  console.log('📋 Setting up contract test environment...');
  
  // Ensure pacts directory exists
  await execAsync('mkdir -p pacts');
  
  // Set Pact environment variables
  process.env.PACT_BROKER_BASE_URL = process.env.PACT_BROKER_BASE_URL || 'http://localhost:9292';
  process.env.PACT_BROKER_USERNAME = process.env.PACT_BROKER_USERNAME || 'pact_workshop';
  process.env.PACT_BROKER_PASSWORD = process.env.PACT_BROKER_PASSWORD || 'pact_workshop';
  
  console.log('✅ Contract test environment ready');
}
