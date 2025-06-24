import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const db = neon(process.env.DATABASE_URL);

async function addEscrowTables() {
  try {
    console.log('Adding escrow tables...');
    
    // Create game_escrows table
    await db`
      CREATE TABLE IF NOT EXISTS game_escrows (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        game_id UUID REFERENCES games(id),
        player_id UUID REFERENCES players(id),
        escrow_account TEXT NOT NULL,
        amount DECIMAL NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('active', 'released', 'refunded')),
        transaction_signature TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        released_at TIMESTAMP WITH TIME ZONE
      );
    `;
    
    console.log('✅ game_escrows table created successfully');
    
    // Create platform_fees table
    await db`
      CREATE TABLE IF NOT EXISTS platform_fees (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        game_id UUID REFERENCES games(id),
        amount DECIMAL NOT NULL,
        transaction_signature TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    console.log('✅ platform_fees table created successfully');
    
    // Create indexes for better performance
    await db`
      CREATE INDEX IF NOT EXISTS idx_game_escrows_game_id ON game_escrows(game_id);
    `;
    
    await db`
      CREATE INDEX IF NOT EXISTS idx_game_escrows_player_id ON game_escrows(player_id);
    `;
    
    await db`
      CREATE INDEX IF NOT EXISTS idx_game_escrows_status ON game_escrows(status);
    `;
    
    await db`
      CREATE INDEX IF NOT EXISTS idx_platform_fees_game_id ON platform_fees(game_id);
    `;
    
    console.log('✅ Indexes created successfully');
    
  } catch (error) {
    console.error('❌ Error adding escrow tables:', error);
    process.exit(1);
  }
}

addEscrowTables(); 