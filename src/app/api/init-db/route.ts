import { NextResponse } from 'next/server';
import { db } from '@/lib/db/schema';

export async function POST() {
  try {
    // Add missing columns to existing tables
    await db`
      ALTER TABLE players 
      ADD COLUMN IF NOT EXISTS is_online BOOLEAN NOT NULL DEFAULT false;
    `;

    await db`
      ALTER TABLE game_players 
      ADD COLUMN IF NOT EXISTS game_status TEXT NOT NULL DEFAULT 'active';
    `;

    return NextResponse.json({ success: true, message: 'Database schema updated successfully' });
  } catch (error) {
    console.error('Error updating database schema:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 