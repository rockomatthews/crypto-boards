#!/usr/bin/env node

import https from 'https';

console.log('🚀 Initializing production database...');
console.log('🔧 This will create all required tables for the Crypto Boards platform');

// Get the domain from environment or prompt
const domain = process.env.VERCEL_URL || process.env.NEXT_PUBLIC_SITE_URL;

if (!domain) {
  console.error('❌ Please set VERCEL_URL or NEXT_PUBLIC_SITE_URL environment variable');
  process.exit(1);
}

const url = `https://${domain}/api/setup-db`;

console.log(`🌐 Making request to: ${url}`);

// Make HTTPS POST request
const postData = JSON.stringify({});

const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = https.request(url, options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      
      if (res.statusCode === 200) {
        console.log('✅ Database initialization successful!');
        console.log('📊 Tables created:');
        result.tables.forEach(table => {
          console.log(`   ✓ ${table}`);
        });
        console.log('\n🎉 Your Crypto Boards platform is ready!');
      } else {
        console.error('❌ Database initialization failed:');
        console.error(result);
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Failed to parse response:', error);
      console.error('Raw response:', data);
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request failed:', error);
  process.exit(1);
});

req.write(postData);
req.end(); 