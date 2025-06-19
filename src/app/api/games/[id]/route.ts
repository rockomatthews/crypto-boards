/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/schema';

export async function GET(
  request: NextRequest,
  context: any
) {
  try {
    const gameId = context?.params?.id;

    // Get game details
    const gameResult = await db`
      SELECT 
        g.id,
        g.game_type,
        g.status,
        g.entry_fee,
        g.created_at,
        g.started_at,
        g.ended_at
      FROM games g
      WHERE g.id = ${gameId}
    `;

    if (gameResult.length === 0) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    const game = gameResult[0];

    // Get all players in the game
    const playersResult = await db`
      SELECT 
        p.id,
        p.username,
        p.wallet_address,
        p.avatar_url,
        gp.game_status,
        gp.joined_at,
        gp.is_winner
      FROM game_players gp
      JOIN players p ON gp.player_id = p.id
      WHERE gp.game_id = ${gameId}
      ORDER BY gp.joined_at ASC
    `;

    // Get current game state
    const stateResult = await db`
      SELECT current_state, last_updated
      FROM game_states
      WHERE game_id = ${gameId}
      ORDER BY last_updated DESC
      LIMIT 1
    `;

    const gameWithDetails = {
      ...game,
      players: playersResult,
      currentState: stateResult.length > 0 ? stateResult[0].current_state : null
    };

    return NextResponse.json(gameWithDetails);
  } catch (error) {
    console.error('Error fetching game:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 