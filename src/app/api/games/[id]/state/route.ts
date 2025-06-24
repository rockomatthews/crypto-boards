/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/schema';

// Skip database operations during build
if (!process.env.DATABASE_URL && process.env.NODE_ENV !== 'development') {
  console.log('Skipping database operations during build');
}

// Our actual game state structure from CheckersBoard
interface GamePiece {
  type: 'red' | 'black' | null;
  isKing: boolean;
}

interface ActualGameState {
  board: (GamePiece | null)[][];
  currentPlayer: 'red' | 'black';
  redPlayer: string | null;
  blackPlayer: string | null;
  gameStatus: 'waiting' | 'active' | 'finished';
  winner: 'red' | 'black' | null;
  lastMove?: {
    from: [number, number];
    to: [number, number];
    capturedPieces?: [number, number][];
  };
}

export async function GET(
  request: NextRequest,
  context: any
) {
  try {
    // Skip during build
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not available during build' }, { status: 503 });
    }

    const gameId = context?.params?.id;

    if (!gameId) {
      return NextResponse.json({ error: 'Game ID is required' }, { status: 400 });
    }

    // Get current game state
    const stateResult = await db`
      SELECT current_state, last_updated
      FROM game_states
      WHERE game_id = ${gameId}
      ORDER BY last_updated DESC
      LIMIT 1
    `;

    if (stateResult.length === 0) {
      return NextResponse.json({ error: 'Game state not found' }, { status: 404 });
    }

    return NextResponse.json({
      gameId,
      currentState: stateResult[0].current_state,
      lastUpdated: stateResult[0].last_updated
    });
  } catch (error) {
    console.error('Error fetching game state:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  context: any
) {
  try {
    // Skip during build
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not available during build' }, { status: 503 });
    }

    const gameId = context?.params?.id;
    const { newState, playerId } = await request.json();

    if (!gameId) {
      return NextResponse.json({ error: 'Game ID is required' }, { status: 400 });
    }

    if (!newState || !playerId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const gameState = newState as ActualGameState;

    // Validate that the game exists
    const gameExists = await db`
      SELECT id FROM games WHERE id = ${gameId}
    `;

    if (gameExists.length === 0) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    // Validate that the player is in the game
    const playerInGameResult = await db`
      SELECT game_status FROM game_players 
      WHERE game_id = ${gameId} AND player_id = ${playerId}
    `;

    if (playerInGameResult.length === 0) {
      return NextResponse.json({ error: 'Player not in game' }, { status: 403 });
    }

    // Insert new game state (we'll keep all moves as history)
    const insertResult = await db`
      INSERT INTO game_states (game_id, current_state)
      VALUES (${gameId}, ${JSON.stringify(newState)})
      RETURNING id
    `;

    // Check for game end conditions
    if (gameState.gameStatus === 'finished' && gameState.winner) {
      // Update game status to completed
      await db`
        UPDATE games 
        SET status = 'completed', ended_at = CURRENT_TIMESTAMP
        WHERE id = ${gameId}
      `;

      // Try to mark winner in game_players table (if the player exists)
      try {
        await db`
          UPDATE game_players 
          SET is_winner = true
          WHERE game_id = ${gameId} AND player_id = ${playerId}
        `;
      } catch (winnerUpdateError) {
        console.log('Could not update winner status:', winnerUpdateError);
        // This is not critical, continue
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Game state updated successfully',
      gameEnded: gameState.gameStatus === 'finished',
      winner: gameState.winner,
      stateId: insertResult[0].id
    });
  } catch (error) {
    console.error('Error updating game state:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 