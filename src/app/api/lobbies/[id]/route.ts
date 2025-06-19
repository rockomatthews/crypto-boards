import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/schema';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const lobbyId = params.id;

    // Get lobby details with creator info
    const lobbyResult = await db`
      SELECT 
        g.id,
        g.game_type,
        g.status,
        g.max_players,
        g.entry_fee,
        g.is_private,
        g.created_at,
        p.username as creator_name,
        p.wallet_address as creator_wallet
      FROM games g
      JOIN players p ON g.creator_id = p.id
      WHERE g.id = ${lobbyId}
    `;

    if (lobbyResult.length === 0) {
      return NextResponse.json({ error: 'Lobby not found' }, { status: 404 });
    }

    const lobby = lobbyResult[0];

    // Get all players in the lobby
    const playersResult = await db`
      SELECT 
        p.id,
        p.username,
        p.wallet_address,
        p.avatar_url,
        gp.game_status,
        gp.joined_at
      FROM game_players gp
      JOIN players p ON gp.player_id = p.id
      WHERE gp.game_id = ${lobbyId}
      ORDER BY gp.joined_at ASC
    `;

    const lobbyWithPlayers = {
      ...lobby,
      players: playersResult
    };

    return NextResponse.json(lobbyWithPlayers);
  } catch (error) {
    console.error('Error fetching lobby:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 