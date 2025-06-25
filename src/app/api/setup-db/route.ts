import { NextResponse } from 'next/server';
import { db } from '@/lib/db/schema';

export async function POST() {
  try {
    console.log('🔧 Setting up database tables...');

    // Create players table
    await db`
      CREATE TABLE IF NOT EXISTS players (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        wallet_address TEXT UNIQUE NOT NULL,
        username TEXT UNIQUE NOT NULL,
        avatar_url TEXT,
        is_online BOOLEAN NOT NULL DEFAULT false,
        phone_number TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log('✅ Players table created');

    // Create games table
    await db`
      CREATE TABLE IF NOT EXISTS games (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        game_type TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        started_at TIMESTAMP WITH TIME ZONE,
        ended_at TIMESTAMP WITH TIME ZONE,
        max_players INTEGER NOT NULL,
        entry_fee DECIMAL NOT NULL,
        is_private BOOLEAN NOT NULL DEFAULT false,
        creator_id UUID REFERENCES players(id)
      );
    `;
    console.log('✅ Games table created');

    // Create game_players table
    await db`
      CREATE TABLE IF NOT EXISTS game_players (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        game_id UUID REFERENCES games(id),
        player_id UUID REFERENCES players(id),
        game_status TEXT NOT NULL DEFAULT 'active',
        joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        left_at TIMESTAMP WITH TIME ZONE,
        is_winner BOOLEAN,
        UNIQUE(game_id, player_id)
      );
    `;
    console.log('✅ Game players table created');

    // Create game_states table
    await db`
      CREATE TABLE IF NOT EXISTS game_states (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        game_id UUID REFERENCES games(id),
        current_state JSONB NOT NULL,
        last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log('✅ Game states table created');

    // Create game_escrows table - CRITICAL FOR SOL BETTING
    await db`
      CREATE TABLE IF NOT EXISTS game_escrows (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        game_id UUID NOT NULL REFERENCES games(id),
        player_id UUID NOT NULL REFERENCES players(id),
        escrow_account TEXT NOT NULL,
        amount DECIMAL(18, 9) NOT NULL,
        status VARCHAR(20) DEFAULT 'active',
        transaction_signature TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        released_at TIMESTAMP WITH TIME ZONE
      );
    `;
    console.log('✅ Game escrows table created');

    // Create game_payouts table - FOR WINNER PAYMENTS
    await db`
      CREATE TABLE IF NOT EXISTS game_payouts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        game_id UUID NOT NULL REFERENCES games(id),
        winner_wallet TEXT NOT NULL,
        amount DECIMAL(18, 9) NOT NULL,
        transaction_signature TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log('✅ Game payouts table created');

    // Create game_refunds table - FOR CANCELED GAMES
    await db`
      CREATE TABLE IF NOT EXISTS game_refunds (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        game_id UUID NOT NULL REFERENCES games(id),
        player_wallet TEXT NOT NULL,
        amount DECIMAL(18, 9) NOT NULL,
        transaction_signature TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log('✅ Game refunds table created');

    // Create platform_fees table - FOR 4% PLATFORM REVENUE
    await db`
      CREATE TABLE IF NOT EXISTS platform_fees (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        game_id UUID NOT NULL REFERENCES games(id),
        amount DECIMAL(18, 9) NOT NULL,
        transaction_signature TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log('✅ Platform fees table created');

    // Create friendships table
    await db`
      CREATE TABLE IF NOT EXISTS friendships (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        player_id UUID REFERENCES players(id),
        friend_id UUID REFERENCES players(id),
        status TEXT NOT NULL DEFAULT 'accepted',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(player_id, friend_id)
      );
    `;
    console.log('✅ Friendships table created');

    // Create chat tables for global chat
    await db`
      CREATE TABLE IF NOT EXISTS chat_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        wallet_address TEXT UNIQUE NOT NULL,
        username TEXT NOT NULL,
        avatar_url TEXT,
        is_online BOOLEAN DEFAULT false,
        last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log('✅ Chat users table created');

    await db`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES chat_users(id),
        message TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log('✅ Chat messages table created');

    // Create player stats table
    await db`
      CREATE TABLE IF NOT EXISTS player_stats (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        player_id UUID UNIQUE REFERENCES players(id),
        games_played INTEGER DEFAULT 0,
        games_won INTEGER DEFAULT 0,
        total_winnings DECIMAL(18, 9) DEFAULT 0,
        total_losses DECIMAL(18, 9) DEFAULT 0,
        current_streak INTEGER DEFAULT 0,
        best_streak INTEGER DEFAULT 0,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log('✅ Player stats table created');

    // Create game stats table for individual game records
    await db`
      CREATE TABLE IF NOT EXISTS game_stats (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        game_id UUID NOT NULL REFERENCES games(id),
        player_id UUID NOT NULL REFERENCES players(id),
        opponent_id UUID NOT NULL REFERENCES players(id),
        game_type TEXT NOT NULL,
        result TEXT NOT NULL, -- 'win' or 'loss'
        amount DECIMAL(18, 9) NOT NULL, -- amount won or lost
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(game_id, player_id)
      );
    `;
    console.log('✅ Game stats table created');

    // Create indexes for performance
    console.log('🔧 Creating indexes...');
    
    await db`CREATE INDEX IF NOT EXISTS idx_game_escrows_game_id ON game_escrows(game_id);`;
    await db`CREATE INDEX IF NOT EXISTS idx_game_escrows_player_id ON game_escrows(player_id);`;
    await db`CREATE INDEX IF NOT EXISTS idx_game_escrows_status ON game_escrows(status);`;
    await db`CREATE INDEX IF NOT EXISTS idx_game_payouts_game_id ON game_payouts(game_id);`;
    await db`CREATE INDEX IF NOT EXISTS idx_game_refunds_game_id ON game_refunds(game_id);`;
    await db`CREATE INDEX IF NOT EXISTS idx_platform_fees_game_id ON platform_fees(game_id);`;
    await db`CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);`;
    await db`CREATE INDEX IF NOT EXISTS idx_games_game_type ON games(game_type);`;
    await db`CREATE INDEX IF NOT EXISTS idx_game_players_game_id ON game_players(game_id);`;
    await db`CREATE INDEX IF NOT EXISTS idx_game_players_player_id ON game_players(player_id);`;
    await db`CREATE INDEX IF NOT EXISTS idx_game_players_status ON game_players(game_status);`;
    await db`CREATE INDEX IF NOT EXISTS idx_game_stats_game_id ON game_stats(game_id);`;
    await db`CREATE INDEX IF NOT EXISTS idx_game_stats_player_id ON game_stats(player_id);`;
    await db`CREATE INDEX IF NOT EXISTS idx_game_stats_result ON game_stats(result);`;
    await db`CREATE INDEX IF NOT EXISTS idx_player_stats_player_id ON player_stats(player_id);`;
    
    console.log('✅ All indexes created');

    console.log('🎉 Database setup complete!');

    return NextResponse.json({ 
      success: true, 
      message: 'All database tables and indexes created successfully',
      tables: [
        'players',
        'games', 
        'game_players',
        'game_states',
        'game_escrows',
        'game_payouts', 
        'game_refunds',
        'platform_fees',
        'friendships',
        'chat_users',
        'chat_messages',
        'player_stats',
        'game_stats'
      ]
    });
  } catch (error) {
    console.error('❌ Error setting up database:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
} 