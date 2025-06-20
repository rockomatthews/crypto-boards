import { NextResponse } from 'next/server';
import { db } from '@/lib/db/schema';

export async function POST() {
  try {
    // Update game_players table to allow new status values
    await db`
      ALTER TABLE game_players 
      DROP CONSTRAINT IF EXISTS game_players_game_status_check;
    `;

    await db`
      ALTER TABLE game_players 
      ADD CONSTRAINT game_players_game_status_check 
      CHECK (game_status IN ('active', 'completed', 'left', 'waiting', 'ready', 'invited'));
    `;

    // Update games table to allow new status values
    await db`
      ALTER TABLE games 
      DROP CONSTRAINT IF EXISTS games_status_check;
    `;

    await db`
      ALTER TABLE games 
      ADD CONSTRAINT games_status_check 
      CHECK (status IN ('waiting', 'in_progress', 'completed'));
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

    return NextResponse.json({ 
      success: true, 
      message: 'Database schema updated successfully' 
    });
  } catch (error) {
    console.error('Error updating schema:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 