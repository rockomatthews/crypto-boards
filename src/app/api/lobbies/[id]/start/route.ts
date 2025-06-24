/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/schema';

export async function POST(
  request: NextRequest,
  context: any
) {
  try {
    const lobbyId = context?.params?.id;

    // Get lobby details
    const lobbyResult = await db`
      SELECT 
        g.id,
        g.game_type,
        g.creator_id,
        g.max_players,
        g.entry_fee,
        COUNT(gp.player_id) as player_count,
        COUNT(CASE WHEN gp.game_status = 'ready' THEN 1 END) as ready_count
      FROM games g
      LEFT JOIN game_players gp ON g.id = gp.game_id
      WHERE g.id = ${lobbyId}
      GROUP BY g.id, g.game_type, g.creator_id, g.max_players, g.entry_fee
    `;

    if (lobbyResult.length === 0) {
      return NextResponse.json({ error: 'Lobby not found' }, { status: 404 });
    }

    const lobby = lobbyResult[0];

    // Check if all players are ready
    if (lobby.ready_count < lobby.player_count) {
      return NextResponse.json({ 
        error: 'Not all players are ready',
        readyCount: lobby.ready_count,
        totalCount: lobby.player_count
      }, { status: 400 });
    }

    // Check if we have enough players
    if (lobby.player_count < 2) {
      return NextResponse.json({ 
        error: 'Need at least 2 players to start',
        playerCount: lobby.player_count
      }, { status: 400 });
    }

    // Get the actual players with their wallet addresses
    const playersResult = await db`
      SELECT p.wallet_address
      FROM game_players gp
      JOIN players p ON gp.player_id = p.id
      WHERE gp.game_id = ${lobbyId}
      ORDER BY gp.joined_at ASC
    `;

    // Update game status to in_progress
    await db`
      UPDATE games 
      SET status = 'in_progress', started_at = CURRENT_TIMESTAMP
      WHERE id = ${lobbyId}
    `;

    // Update all players to active status
    await db`
      UPDATE game_players 
      SET game_status = 'active'
      WHERE game_id = ${lobbyId}
    `;

    // Initialize game state based on game type
    let initialState;
    switch (lobby.game_type.toLowerCase()) {
      case 'checkers':
        // Create board with proper piece objects that match CheckersBoard expectations
        const board = Array(8).fill(null).map(() => Array(8).fill(null));
        
        // Place black pieces (top 3 rows)
        for (let row = 0; row < 3; row++) {
          for (let col = 0; col < 8; col++) {
            if ((row + col) % 2 === 1) {
              board[row][col] = { type: 'black', isKing: false };
            }
          }
        }
        
        // Place red pieces (bottom 3 rows) 
        for (let row = 5; row < 8; row++) {
          for (let col = 0; col < 8; col++) {
            if ((row + col) % 2 === 1) {
              board[row][col] = { type: 'red', isKing: false };
            }
          }
        }
        
        initialState = {
          board,
          currentPlayer: 'red',
          redPlayer: playersResult[0]?.wallet_address || null,
          blackPlayer: playersResult[1]?.wallet_address || null,
          gameStatus: 'active',
          winner: null,
          lastMove: null
        };
        break;
      default:
        initialState = {};
    }

    // Create initial game state
    await db`
      INSERT INTO game_states (game_id, current_state)
      VALUES (${lobbyId}, ${JSON.stringify(initialState)})
    `;

    return NextResponse.json({ 
      success: true, 
      message: 'Game started successfully!',
      gameId: lobbyId,
      gameType: lobby.game_type
    });
  } catch (error) {
    console.error('Error starting game:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 