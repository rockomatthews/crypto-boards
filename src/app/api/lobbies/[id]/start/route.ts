import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/schema';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const lobbyId = params.id;

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
        initialState = {
          board: [
            ['empty', 'black', 'empty', 'black', 'empty', 'black', 'empty', 'black'],
            ['black', 'empty', 'black', 'empty', 'black', 'empty', 'black', 'empty'],
            ['empty', 'black', 'empty', 'black', 'empty', 'black', 'empty', 'black'],
            ['empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
            ['empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
            ['white', 'empty', 'white', 'empty', 'white', 'empty', 'white', 'empty'],
            ['empty', 'white', 'empty', 'white', 'empty', 'white', 'empty', 'white'],
            ['white', 'empty', 'white', 'empty', 'white', 'empty', 'white', 'empty']
          ],
          currentTurn: 'black',
          selectedPiece: null,
          validMoves: [],
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