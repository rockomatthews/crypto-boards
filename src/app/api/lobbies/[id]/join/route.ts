import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/schema';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { walletAddress } = await request.json();
    const lobbyId = params.id;

    if (!walletAddress || !lobbyId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get or create the player
    const playerResult = await db`
      INSERT INTO players (wallet_address, username, avatar_url)
      VALUES (${walletAddress}, ${`Player${walletAddress.slice(0, 4)}`}, '')
      ON CONFLICT (wallet_address) DO UPDATE SET
        last_login = CURRENT_TIMESTAMP
      RETURNING id
    `;

    if (playerResult.length === 0) {
      return NextResponse.json({ error: 'Failed to create/find player' }, { status: 500 });
    }

    const playerId = playerResult[0].id;

    // Check if lobby exists and has space
    const lobbyResult = await db`
      SELECT 
        g.id,
        g.max_players,
        g.entry_fee,
        g.status,
        COUNT(gp.player_id) as current_players
      FROM games g
      LEFT JOIN game_players gp ON g.id = gp.game_id
      WHERE g.id = ${lobbyId}
      GROUP BY g.id, g.max_players, g.entry_fee, g.status
    `;

    if (lobbyResult.length === 0) {
      return NextResponse.json({ error: 'Lobby not found' }, { status: 404 });
    }

    const lobby = lobbyResult[0];

    if (lobby.status !== 'waiting') {
      return NextResponse.json({ error: 'Lobby is not accepting players' }, { status: 400 });
    }

    if (lobby.current_players >= lobby.max_players) {
      return NextResponse.json({ error: 'Lobby is full' }, { status: 400 });
    }

    // Check if player is already in the lobby
    const existingPlayerResult = await db`
      SELECT game_status FROM game_players 
      WHERE game_id = ${lobbyId} AND player_id = ${playerId}
    `;

    if (existingPlayerResult.length > 0) {
      const existingStatus = existingPlayerResult[0].game_status;
      
      if (existingStatus === 'ready') {
        return NextResponse.json({ error: 'Already ready in this lobby' }, { status: 400 });
      }
      
      if (existingStatus === 'invited') {
        // Update status to waiting (needs to pay)
        await db`
          UPDATE game_players 
          SET game_status = 'waiting'
          WHERE game_id = ${lobbyId} AND player_id = ${playerId}
        `;
      }
    } else {
      // Add player to lobby with waiting status
      await db`
        INSERT INTO game_players (game_id, player_id, game_status)
        VALUES (${lobbyId}, ${playerId}, 'waiting')
      `;
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Joined lobby successfully. Please pay the entry fee to become ready.',
      entryFee: lobby.entry_fee
    });
  } catch (error) {
    console.error('Error joining lobby:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 