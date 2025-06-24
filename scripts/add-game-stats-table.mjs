import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const db = neon(process.env.DATABASE_URL);

async function addGameStatsTable() {
  try {
    console.log('Adding game_stats table...');
    
    await db`
      CREATE TABLE IF NOT EXISTS game_stats (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        game_id UUID REFERENCES games(id),
        player_id UUID REFERENCES players(id),
        game_type TEXT NOT NULL,
        result TEXT NOT NULL CHECK (result IN ('win', 'loss')),
        amount DECIMAL NOT NULL,
        opponent_id UUID REFERENCES players(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    console.log('✅ game_stats table created successfully');
    
    // Create index for better performance
    await db`
      CREATE INDEX IF NOT EXISTS idx_game_stats_player_id ON game_stats(player_id);
    `;
    
    await db`
      CREATE INDEX IF NOT EXISTS idx_game_stats_created_at ON game_stats(created_at DESC);
    `;
    
    console.log('✅ Indexes created successfully');
    
  } catch (error) {
    console.error('❌ Error adding game_stats table:', error);
    process.exit(1);
  }
}

addGameStatsTable(); 