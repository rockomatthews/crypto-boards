import { neon } from '@neondatabase/serverless';

// Database connection
export const db = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : neon('postgresql://dummy:dummy@localhost:5432/dummy');

// Types
export interface Player {
  id: string;
  wallet_address: string;
  username: string;
  avatar_url: string;
  phone_number?: string;
  sms_notifications_enabled: boolean;
  sms_opted_in_at?: Date;
  is_online: boolean;
  created_at: Date;
  last_login: Date;
}

export interface Game {
  id: string;
  game_type: 'checkers' | 'chess' | 'stratego' | 'shoots-ladders';
  status: 'waiting' | 'in_progress' | 'completed';
  created_at: Date;
  started_at: Date | null;
  ended_at: Date | null;
  max_players: number;
  entry_fee: number;
  is_private: boolean;
  creator_id: string;
}

export interface GamePlayer {
  id: string;
  game_id: string;
  player_id: string;
  game_status: 'active' | 'completed' | 'left';
  joined_at: Date;
  left_at: Date | null;
  is_winner: boolean | null;
}

// Types for game states
export interface CheckersGameState {
  board: Array<Array<'empty' | 'black' | 'white' | 'black-king' | 'white-king'>>;
  currentTurn: 'black' | 'white';
  selectedPiece: { row: number; col: number } | null;
  validMoves: Array<{ row: number; col: number }>;
  lastMove: { from: { row: number; col: number }; to: { row: number; col: number } } | null;
}

export interface GameState {
  id: string;
  game_id: string;
  current_state: CheckersGameState; // Now using the specific type
  last_updated: Date;
}

export interface Friendship {
  id: string;
  player_id: string;
  friend_id: string;
  status: 'pending' | 'accepted';
  created_at: Date;
  updated_at: Date;
}

export interface GamePayout {
  id: string;
  game_id: string;
  winner_wallet: string;
  amount: number;
  transaction_signature: string;
  created_at: Date;
}

export interface GameRefund {
  id: string;
  game_id: string;
  player_wallet: string;
  amount: number;
  transaction_signature: string;
  created_at: Date;
}

export interface ChatMessage {
  id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'game_invite' | 'friend_request';
  created_at: Date;
  is_global: boolean;
  recipient_id?: string;
}

export interface OnlineUser {
  id: string;
  player_id: string;
  last_seen: Date;
  is_online: boolean;
}

export interface GameStat {
  id: string;
  game_id: string;
  player_id: string;
  game_type: 'checkers' | 'chess' | 'go' | 'poker';
  result: 'win' | 'loss';
  amount: number;
  opponent_id: string;
  created_at: Date;
}

export interface GameEscrow {
  id: string;
  game_id: string;
  player_id: string;
  escrow_account: string; // Public key of the escrow account
  amount: number;
  status: 'active' | 'released' | 'refunded';
  transaction_signature: string;
  created_at: Date;
  released_at?: Date;
}

export interface PlatformFee {
  id: string;
  game_id: string;
  amount: number;
  transaction_signature: string;
  created_at: Date;
}

// Database initialization
export async function initializeDatabase() {
  try {
    // Create players table
    await db`
      CREATE TABLE IF NOT EXISTS players (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        wallet_address TEXT UNIQUE NOT NULL,
        username TEXT UNIQUE NOT NULL,
        avatar_url TEXT,
        phone_number TEXT,
        sms_notifications_enabled BOOLEAN NOT NULL DEFAULT false,
        sms_opted_in_at TIMESTAMP WITH TIME ZONE,
        is_online BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

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

    // Create game_states table
    await db`
      CREATE TABLE IF NOT EXISTS game_states (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        game_id UUID REFERENCES games(id),
        current_state JSONB NOT NULL,
        last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

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

    // Create game_refunds table
    await db`
      CREATE TABLE IF NOT EXISTS game_refunds (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        game_id UUID REFERENCES games(id),
        player_wallet TEXT NOT NULL,
        amount DECIMAL NOT NULL,
        transaction_signature TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Create chat_messages table
    await db`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sender_id UUID REFERENCES players(id),
        content TEXT NOT NULL,
        message_type TEXT NOT NULL DEFAULT 'text',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        is_global BOOLEAN NOT NULL DEFAULT true,
        recipient_id UUID REFERENCES players(id)
      );
    `;

    // Create online_users table
    await db`
      CREATE TABLE IF NOT EXISTS online_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        player_id UUID REFERENCES players(id) UNIQUE,
        last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        is_online BOOLEAN NOT NULL DEFAULT true
      );
    `;

    // Create friendships table
    await db`
      CREATE TABLE IF NOT EXISTS friendships (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        player_id UUID REFERENCES players(id),
        friend_id UUID REFERENCES players(id),
        status TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(player_id, friend_id)
      );
    `;

    // Create game_stats table
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

    // Create sms_invitations table
    await db`
      CREATE TABLE IF NOT EXISTS sms_invitations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sender_wallet TEXT NOT NULL,
        phone_number TEXT NOT NULL,
        lobby_id TEXT NOT NULL,
        message TEXT NOT NULL,
        sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
} 