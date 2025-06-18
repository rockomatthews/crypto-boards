import { neon } from '@neondatabase/serverless';

// Database connection
export const db = neon(process.env.DATABASE_URL!);

// Types
export interface Player {
  id: string;
  wallet_address: string;
  username: string;
  avatar_url: string;
  created_at: Date;
  last_login: Date;
}

export interface Game {
  id: string;
  game_type: 'checkers' | 'chess' | 'go' | 'poker';
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

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
} 