/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';

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

// Temporary in-memory storage while database is being fixed
const gameStates = new Map<string, ActualGameState>();

export async function GET(
  request: NextRequest,
  context: any
) {
  try {
    const gameId = context?.params?.id;

    if (!gameId) {
      return NextResponse.json({ error: 'Game ID is required' }, { status: 400 });
    }

    // Try to get from our temporary storage first
    const cachedState = gameStates.get(gameId);
    if (cachedState) {
      return NextResponse.json({
        gameId,
        currentState: cachedState,
        lastUpdated: new Date().toISOString()
      });
    }

    // Try database connection with fallback
    try {
      const { db } = await import('@/lib/db/schema');
      
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

      // Cache the result for future requests
      gameStates.set(gameId, stateResult[0].current_state);

      return NextResponse.json({
        gameId,
        currentState: stateResult[0].current_state,
        lastUpdated: stateResult[0].last_updated
      });
    } catch {
      console.log('Database unavailable, using fallback storage');
      return NextResponse.json({ error: 'Game state not found' }, { status: 404 });
    }
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
    const gameId = context?.params?.id;
    const { newState, playerId } = await request.json();

    if (!gameId) {
      return NextResponse.json({ error: 'Game ID is required' }, { status: 400 });
    }

    if (!newState || !playerId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const gameState = newState as ActualGameState;

    // Try database connection with fallback to in-memory storage
    try {
      const { db } = await import('@/lib/db/schema');
      
      // Validate that the game exists
      const gameExists = await db`
        SELECT id FROM games WHERE id = ${gameId}
      `;

      if (gameExists.length === 0) {
        return NextResponse.json({ error: 'Game not found' }, { status: 404 });
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

      // Also cache in memory for faster access
      gameStates.set(gameId, gameState);

      return NextResponse.json({ 
        success: true, 
        message: 'Game state updated successfully (database)',
        gameEnded: gameState.gameStatus === 'finished',
        winner: gameState.winner,
        stateId: insertResult[0].id
      });
    } catch {
      console.log('Database unavailable, using fallback storage for gameId:', gameId);
      
      // Fallback to in-memory storage
      gameStates.set(gameId, gameState);
      
      return NextResponse.json({ 
        success: true, 
        message: 'Game state updated successfully (fallback storage)',
        gameEnded: gameState.gameStatus === 'finished',
        winner: gameState.winner,
        stateId: `fallback_${Date.now()}`
      });
    }
  } catch (error) {
    console.error('Error updating game state:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 