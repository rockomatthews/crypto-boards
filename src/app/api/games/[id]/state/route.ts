/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/schema';
import { CheckersGameState } from '@/lib/db/schema';

export async function GET(
  request: NextRequest,
  context: any
) {
  try {
    const gameId = context?.params?.id;

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
    const gameId = context?.params?.id;
    const { newState, playerId, move } = await request.json();

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

    // Get current game state to validate the move
    const currentStateResult = await db`
      SELECT current_state FROM game_states
      WHERE game_id = ${gameId}
      ORDER BY last_updated DESC
      LIMIT 1
    `;

    if (currentStateResult.length === 0) {
      return NextResponse.json({ error: 'Game state not found' }, { status: 404 });
    }

    const currentState = currentStateResult[0].current_state as CheckersGameState;

    // Validate the move (basic validation)
    if (move && !isValidMove(currentState, move, playerId)) {
      return NextResponse.json({ error: 'Invalid move' }, { status: 400 });
    }

    // Update game state
    await db`
      INSERT INTO game_states (game_id, current_state)
      VALUES (${gameId}, ${JSON.stringify(newState)})
    `;

    // Check for game end conditions
    const gameEndResult = checkGameEnd(newState);
    if (gameEndResult.isGameOver) {
      // Update game status to completed
      await db`
        UPDATE games 
        SET status = 'completed', ended_at = CURRENT_TIMESTAMP
        WHERE id = ${gameId}
      `;

      // Mark winner
      if (gameEndResult.winner) {
        await db`
          UPDATE game_players 
          SET is_winner = true
          WHERE game_id = ${gameId} AND player_id = ${playerId}
        `;
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Game state updated successfully',
      gameEnded: gameEndResult.isGameOver,
      winner: gameEndResult.winner
    });
  } catch (error) {
    console.error('Error updating game state:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Basic move validation for checkers
function isValidMove(currentState: CheckersGameState, move: any, playerId: string): boolean {
  // This is a simplified validation - in a real implementation,
  // you would have more comprehensive game logic
  const { from, to } = move;
  
  // Check if the move is within bounds
  if (from.row < 0 || from.row > 7 || from.col < 0 || from.col > 7 ||
      to.row < 0 || to.row > 7 || to.col < 0 || to.col > 7) {
    return false;
  }

  // Check if the piece exists at the from position
  const piece = currentState.board[from.row][from.col];
  if (piece === 'empty') {
    return false;
  }

  // Check if it's the player's turn
  const playerColor = getPlayerColor(playerId); // You'd need to implement this
  if (piece !== playerColor && piece !== `${playerColor}-king`) {
    return false;
  }

  return true;
}

// Check if the game has ended
function checkGameEnd(gameState: CheckersGameState): { isGameOver: boolean; winner?: string } {
  // Count pieces for each player
  let blackPieces = 0;
  let whitePieces = 0;

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = gameState.board[row][col];
      if (piece === 'black' || piece === 'black-king') {
        blackPieces++;
      } else if (piece === 'white' || piece === 'white-king') {
        whitePieces++;
      }
    }
  }

  if (blackPieces === 0) {
    return { isGameOver: true, winner: 'white' };
  } else if (whitePieces === 0) {
    return { isGameOver: true, winner: 'black' };
  }

  return { isGameOver: false };
}

// Helper function to get player color (simplified)
function getPlayerColor(playerId: string): 'black' | 'white' {
  // In a real implementation, you'd look this up from the database
  // For now, we'll use a simple hash-based approach
  const hash = playerId.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  return hash % 2 === 0 ? 'black' : 'white';
} 