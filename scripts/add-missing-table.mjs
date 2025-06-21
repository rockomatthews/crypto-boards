#!/usr/bin/env node

import { neon } from '@neondatabase/serverless';

// Get database URL from environment
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  console.log('Please set it with: export DATABASE_URL="your_neon_connection_string"');
  process.exit(1);
}

const db = neon(DATABASE_URL);

async function addMissingTable() {
  try {
    console.log('🔧 Adding missing game_payouts table...');
    
    // Create game_payouts table
    await db`
      CREATE TABLE IF NOT EXISTS game_payouts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        game_id UUID REFERENCES games(id),
        winner_wallet TEXT NOT NULL,
        amount DECIMAL NOT NULL,
        transaction_signature TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    console.log('✅ game_payouts table created successfully!');
    
    // List all tables to verify
    const tables = await db`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;
    
    console.log('\n📋 Current database tables:');
    tables.forEach(table => {
      console.log(`  - ${table.table_name}`);
    });
    
  } catch (error) {
    console.error('❌ Error adding table:', error);
    process.exit(1);
  }
}

addMissingTable(); 