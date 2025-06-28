#!/usr/bin/env node

import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const db = neon(process.env.DATABASE_URL);

async function setupSmsDatabase() {
  try {
    console.log('🔧 Adding SMS notification fields to database...');

    // Add SMS notification fields to players table
    await db`
      ALTER TABLE players 
      ADD COLUMN IF NOT EXISTS sms_notifications_enabled BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS sms_opted_in_at TIMESTAMP WITH TIME ZONE
    `;

    console.log('✅ SMS notification fields added successfully');
    
    // Check current state
    const playerCount = await db`
      SELECT COUNT(*) as count FROM players
    `;
    
    const smsEnabledCount = await db`
      SELECT COUNT(*) as count FROM players 
      WHERE sms_notifications_enabled = true
    `;

    console.log(`📊 Database Status:`);
    console.log(`   Total players: ${playerCount[0].count}`);
    console.log(`   SMS enabled: ${smsEnabledCount[0].count}`);
    
    console.log('\n🎯 Next steps:');
    console.log('1. Configure your SMS provider (Twilio or TextGrid) in .env');
    console.log('2. Set your SMS_PROVIDER environment variable');
    console.log('3. Players can now opt-in to SMS notifications in their profile');
    
  } catch (error) {
    console.error('❌ Error setting up SMS database:', error);
    process.exit(1);
  }
}

setupSmsDatabase(); 