// Integration test specific setup
console.log('🔧 Setting up integration test environment...');

// Load deployment environment variables if available
const fs = require('fs');
const path = require('path');

const deploymentEnvPath = path.join(__dirname, '../../.env.deployment');
if (fs.existsSync(deploymentEnvPath)) {
  console.log('📂 Loading deployment environment from .env.deployment');
  
  // Read the file and set environment variables
  const content = fs.readFileSync(deploymentEnvPath, 'utf8');
  const lines = content.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('export ')) {
      // Extract export statement: export VAR="value"
      const match = trimmed.match(/export\s+([^=]+)="([^"]*)"/);
      if (match) {
        const [, key, value] = match;
        process.env[key] = value;
        console.log(`  ✓ ${key}=${value.substring(0, 50)}${value.length > 50 ? '...' : ''}`);
      }
    }
  }
} else {
  console.log('⚠️  No .env.deployment file found. Run npm run deploy:export first.');
}
