/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/schema';

export async function POST(
  request: NextRequest,
  context: any
) {
  try {
    const { walletAddress } = await request.json();
    const lobbyId = context?.params?.id;

    if (!walletAddress || !lobbyId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    console.log(`🚫 Player ${walletAddress.slice(0, 8)}... leaving lobby ${lobbyId}`);

    // Get player ID
    const playerResult = await db`
      SELECT id FROM players WHERE wallet_address = ${walletAddress}
    `;

    if (playerResult.length === 0) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    const playerId = playerResult[0].id;

    // Remove player from lobby
    const deleteResult = await db`
      DELETE FROM game_players 
      WHERE game_id = ${lobbyId} AND player_id = ${playerId}
      RETURNING game_id
    `;

    if (deleteResult.length === 0) {
      return NextResponse.json({ error: 'Player was not in this lobby' }, { status: 400 });
    }

    console.log(`✅ Removed player from lobby ${lobbyId}`);

    // Check if lobby is now empty
    const remainingPlayers = await db`
      SELECT COUNT(*) as count FROM game_players WHERE game_id = ${lobbyId}
    `;

    const playerCount = parseInt(remainingPlayers[0].count);

    if (playerCount === 0) {
      // Delete empty lobby
      await db`DELETE FROM game_states WHERE game_id = ${lobbyId}`;
      await db`DELETE FROM games WHERE id = ${lobbyId}`;
      
      console.log(`🗑️ Deleted empty lobby ${lobbyId}`);
      
      return NextResponse.json({
        success: true,
        message: 'Left game and removed empty lobby',
        lobbyDeleted: true
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully left the game',
      lobbyDeleted: false,
      remainingPlayers: playerCount
    });

  } catch (error) {
    console.error('Error in lobby cancel:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 