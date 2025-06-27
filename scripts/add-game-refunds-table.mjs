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

async function addGameRefundsTable() {
  try {
    console.log('🔧 Adding missing game_refunds table...');
    
    // Create game_refunds table
    await db`
      CREATE TABLE IF NOT EXISTS game_refunds (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        game_id UUID REFERENCES games(id),
        player_wallet TEXT NOT NULL,
        amount DECIMAL(18, 9) NOT NULL,
        transaction_signature TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    console.log('✅ game_refunds table created successfully!');
    
    // Also ensure player stats tables exist
    console.log('🔧 Ensuring player stats tables exist...');
    
    await db`
      CREATE TABLE IF NOT EXISTS player_stats (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        player_id UUID REFERENCES players(id) UNIQUE,
        games_played INTEGER DEFAULT 0,
        games_won INTEGER DEFAULT 0,
        total_winnings DECIMAL(18, 9) DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    console.log('✅ player_stats table created successfully!');
    
    // Create indexes for better performance
    await db`
      CREATE INDEX IF NOT EXISTS idx_game_refunds_game_id ON game_refunds(game_id);
    `;
    
    await db`
      CREATE INDEX IF NOT EXISTS idx_game_refunds_player_wallet ON game_refunds(player_wallet);
    `;
    
    await db`
      CREATE INDEX IF NOT EXISTS idx_player_stats_player_id ON player_stats(player_id);
    `;
    
    console.log('✅ Indexes created successfully!');
    
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
    console.error('❌ Error adding tables:', error);
    process.exit(1);
  }
}

addGameRefundsTable(); 