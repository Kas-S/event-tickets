#!/usr/bin/env node

/**
 * Script to update frontend environment configuration from CDK outputs
 * Run this after deploying infrastructure to sync backend endpoints
 */

const fs = require('fs');
const path = require('path');

const CDK_OUTPUTS_FILE = path.join(__dirname, '../cdk-outputs.json');
const ENV_DEV_FILE = path.join(__dirname, '../frontend/.env.development');
const ENV_PROD_FILE = path.join(__dirname, '../frontend/.env.production');

function updateFrontendConfig() {
  try {
    // Read CDK outputs
    if (!fs.existsSync(CDK_OUTPUTS_FILE)) {
      console.error('❌ CDK outputs file not found. Please deploy infrastructure first.');
      console.log('   Run: npm run deploy:infra');
      process.exit(1);
    }

    const cdkOutputs = JSON.parse(fs.readFileSync(CDK_OUTPUTS_FILE, 'utf8'));

    // Extract configuration values
    const apiStack = cdkOutputs['EventTicketingStackApiStackD88CF0AB'];
    const authStack = cdkOutputs['EventTicketingStackAuthStack8C9D77AA'];
    const frontendStack = cdkOutputs['EventTicketingStackFrontendStack8E3A3C69'];

    if (!apiStack || !authStack || !frontendStack) {
      console.error('❌ Missing required stack outputs in CDK outputs file');
      process.exit(1);
    }

    const config = {
      VITE_API_URL: apiStack.ApiUrl || apiStack.EventTicketingApiEndpointE21C9856,
      VITE_USER_POOL_ID: authStack.UserPoolId,
      VITE_USER_POOL_CLIENT_ID: authStack.UserPoolClientId,
      VITE_AWS_REGION: 'us-east-1',
      VITE_COVER_PHOTO_BUCKET: frontendStack.CoverPhotoBucketName,
    };

    // Validate all required values are present
    const missingValues = Object.entries(config)
      .filter(([_, value]) => !value)
      .map(([key]) => key);

    if (missingValues.length > 0) {
      console.error('❌ Missing required configuration values:', missingValues.join(', '));
      process.exit(1);
    }

    // Generate environment file content
    const envContent = `# AWS Backend Configuration (Auto-generated from CDK deployment)
VITE_API_URL=${config.VITE_API_URL}
VITE_USER_POOL_ID=${config.VITE_USER_POOL_ID}
VITE_USER_POOL_CLIENT_ID=${config.VITE_USER_POOL_CLIENT_ID}
VITE_AWS_REGION=${config.VITE_AWS_REGION}
VITE_COVER_PHOTO_BUCKET=${config.VITE_COVER_PHOTO_BUCKET}
`;

    // Write to both development and production env files
    fs.writeFileSync(ENV_DEV_FILE, envContent);
    fs.writeFileSync(ENV_PROD_FILE, envContent);

    console.log('✅ Frontend configuration updated successfully!');
    console.log('\nConfiguration:');
    console.log(`   API URL: ${config.VITE_API_URL}`);
    console.log(`   User Pool ID: ${config.VITE_USER_POOL_ID}`);
    console.log(`   Client ID: ${config.VITE_USER_POOL_CLIENT_ID}`);
    console.log(`   Region: ${config.VITE_AWS_REGION}`);
    console.log(`   Cover Photo Bucket: ${config.VITE_COVER_PHOTO_BUCKET}`);
    console.log('\nFiles updated:');
    console.log(`   - ${ENV_DEV_FILE}`);
    console.log(`   - ${ENV_PROD_FILE}`);

  } catch (error) {
    console.error('❌ Error updating frontend configuration:', error.message);
    process.exit(1);
  }
}

updateFrontendConfig();
