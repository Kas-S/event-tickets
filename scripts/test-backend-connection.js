#!/usr/bin/env node

/**
 * Test script to verify frontend can connect to backend
 * Tests API Gateway and Cognito connectivity
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const ENV_FILE = path.join(__dirname, '../frontend/.env.production');

function loadEnvFile() {
  if (!fs.existsSync(ENV_FILE)) {
    console.error('❌ Environment file not found:', ENV_FILE);
    console.log('   Run: npm run config:frontend');
    process.exit(1);
  }

  const envContent = fs.readFileSync(ENV_FILE, 'utf8');
  const config = {};
  
  envContent.split('\n').forEach(line => {
    const match = line.match(/^VITE_(\w+)=(.+)$/);
    if (match) {
      config[match[1]] = match[2].trim();
    }
  });

  return config;
}

function testApiGateway(apiUrl) {
  return new Promise((resolve, reject) => {
    console.log('\n🔍 Testing API Gateway connection...');
    const url = apiUrl.endsWith('/') ? `${apiUrl}events` : `${apiUrl}/events`;
    console.log(`   URL: ${url}`);

    https.get(url, (res) => {
      console.log(`   Status: ${res.statusCode}`);
      
      if (res.statusCode === 200 || res.statusCode === 401) {
        console.log('   ✅ API Gateway is reachable');
        resolve(true);
      } else {
        console.log(`   ⚠️  Unexpected status code: ${res.statusCode}`);
        resolve(false);
      }
    }).on('error', (err) => {
      console.log('   ❌ Connection failed:', err.message);
      reject(err);
    });
  });
}

function testCognitoConfig(config) {
  console.log('\n🔍 Checking Cognito configuration...');
  console.log(`   User Pool ID: ${config.USER_POOL_ID}`);
  console.log(`   Client ID: ${config.USER_POOL_CLIENT_ID}`);
  console.log(`   Region: ${config.AWS_REGION}`);
  
  const validPoolId = /^[a-z]+-[a-z]+-\d+_[a-zA-Z0-9]+$/.test(config.USER_POOL_ID);
  const validClientId = /^[a-z0-9]{26}$/.test(config.USER_POOL_CLIENT_ID);
  
  if (validPoolId && validClientId) {
    console.log('   ✅ Cognito configuration looks valid');
    return true;
  } else {
    console.log('   ⚠️  Cognito configuration may be invalid');
    return false;
  }
}

function testS3Config(config) {
  console.log('\n🔍 Checking S3 configuration...');
  console.log(`   Cover Photo Bucket: ${config.COVER_PHOTO_BUCKET}`);
  
  if (config.COVER_PHOTO_BUCKET && config.COVER_PHOTO_BUCKET.length > 0) {
    console.log('   ✅ S3 bucket configured');
    return true;
  } else {
    console.log('   ⚠️  S3 bucket not configured');
    return false;
  }
}

async function runTests() {
  console.log('🚀 Testing Backend Connection\n');
  console.log('=' .repeat(50));

  try {
    const config = loadEnvFile();
    
    console.log('\n📋 Configuration loaded:');
    console.log(`   API URL: ${config.API_URL}`);
    console.log(`   User Pool: ${config.USER_POOL_ID}`);
    console.log(`   Region: ${config.AWS_REGION}`);

    // Test API Gateway
    let apiOk = false;
    try {
      apiOk = await testApiGateway(config.API_URL);
    } catch (err) {
      console.log('   ❌ API Gateway test failed');
    }

    // Test Cognito config
    const cognitoOk = testCognitoConfig(config);

    // Test S3 config
    const s3Ok = testS3Config(config);

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('\n📊 Test Summary:\n');
    console.log(`   API Gateway:  ${apiOk ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Cognito:      ${cognitoOk ? '✅ PASS' : '⚠️  WARNING'}`);
    console.log(`   S3 Bucket:    ${s3Ok ? '✅ PASS' : '⚠️  WARNING'}`);

    if (apiOk && cognitoOk && s3Ok) {
      console.log('\n✅ All tests passed! Backend is ready.\n');
      process.exit(0);
    } else {
      console.log('\n⚠️  Some tests failed. Check configuration.\n');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTests();
