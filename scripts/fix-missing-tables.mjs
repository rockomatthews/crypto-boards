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

async function fixMissingTables() {
  try {
    console.log('🔧 Creating all missing tables for game completion and stats...');
    
    // 1. Create game_refunds table
    console.log('📋 Creating game_refunds table...');
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
    
    // 2. Create player_stats table
    console.log('📋 Creating player_stats table...');
    await db`
      CREATE TABLE IF NOT EXISTS player_stats (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        player_id UUID REFERENCES players(id) UNIQUE,
        games_played INTEGER DEFAULT 0,
        games_won INTEGER DEFAULT 0,
        total_winnings DECIMAL(18, 9) DEFAULT 0,
        total_losses DECIMAL(18, 9) DEFAULT 0,
        current_streak INTEGER DEFAULT 0,
        best_streak INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    // 3. Create game_stats table for detailed game records
    console.log('📋 Creating game_stats table...');
    await db`
      CREATE TABLE IF NOT EXISTS game_stats (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        game_id UUID REFERENCES games(id),
        player_id UUID REFERENCES players(id),
        opponent_id UUID REFERENCES players(id),
        game_type VARCHAR(50) NOT NULL,
        result VARCHAR(10) NOT NULL CHECK (result IN ('win', 'loss', 'draw')),
        amount DECIMAL(18, 9) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    console.log('✅ All tables created successfully!');
    
    // Create indexes for better performance
    console.log('📋 Creating indexes...');
    
    await db`
      CREATE INDEX IF NOT EXISTS idx_game_refunds_game_id ON game_refunds(game_id);
    `;
    
    await db`
      CREATE INDEX IF NOT EXISTS idx_game_refunds_player_wallet ON game_refunds(player_wallet);
    `;
    
    await db`
      CREATE INDEX IF NOT EXISTS idx_player_stats_player_id ON player_stats(player_id);
    `;
    
    await db`
      CREATE INDEX IF NOT EXISTS idx_game_stats_game_id ON game_stats(game_id);
    `;
    
    await db`
      CREATE INDEX IF NOT EXISTS idx_game_stats_player_id ON game_stats(player_id);
    `;
    
    await db`
      CREATE INDEX IF NOT EXISTS idx_game_stats_game_type ON game_stats(game_type);
    `;
    
    console.log('✅ All indexes created successfully!');
    
    // Initialize player stats for existing players who don't have records
    console.log('📋 Initializing player stats for existing players...');
    
    await db`
      INSERT INTO player_stats (player_id, games_played, games_won, total_winnings, total_losses, current_streak, best_streak)
      SELECT p.id, 0, 0, 0, 0, 0, 0
      FROM players p
      WHERE p.id NOT IN (SELECT player_id FROM player_stats WHERE player_id IS NOT NULL)
    `;
    
    console.log('✅ Player stats initialized for existing players!');
    
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
    
    // Check for any players without stats
    const playersWithoutStats = await db`
      SELECT p.username, p.wallet_address
      FROM players p
      LEFT JOIN player_stats ps ON p.id = ps.player_id
      WHERE ps.player_id IS NULL
    `;
    
    if (playersWithoutStats.length > 0) {
      console.log('\n⚠️ Players without stats records:');
      playersWithoutStats.forEach(player => {
        console.log(`  - ${player.username} (${player.wallet_address})`);
      });
    } else {
      console.log('\n✅ All players have stats records!');
    }
    
    console.log('\n🎉 Database migration completed successfully!');
    console.log('🔗 Game completion and stats tracking should now work properly!');
    
  } catch (error) {
    console.error('❌ Error fixing tables:', error);
    process.exit(1);
  }
}

fixMissingTables(); 