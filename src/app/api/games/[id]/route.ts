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
      currentState: stateResult.length > 0 ? stateResult[0].current_state : null,
      lastUpdated: stateResult.length > 0 ? stateResult[0].last_updated : null
    };

    return NextResponse.json(gameWithDetails);
  } catch (error) {
    console.error('Error fetching game:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  context: any
) {
  try {
    const gameId = context?.params?.id;
    const { newState, playerId } = await request.json();

    if (!newState || !playerId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate that the player is in the game
    const playerInGameResult = await db`
      SELECT game_status FROM game_players 
      WHERE game_id = ${gameId} AND player_id = ${playerId}
    `;

    if (playerInGameResult.length === 0) {
      return NextResponse.json({ error: 'Player not in game' }, { status: 403 });
    }

    // Update game state
    await db`
      INSERT INTO game_states (game_id, current_state)
      VALUES (${gameId}, ${JSON.stringify(newState)})
    `;

    return NextResponse.json({ 
      success: true, 
      message: 'Game state updated successfully'
    });
  } catch (error) {
    console.error('Error updating game state:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 