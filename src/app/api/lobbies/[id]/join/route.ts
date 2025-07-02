/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/schema';
import smsService from '@/lib/sms';

export async function POST(
  request: NextRequest,
  context: any
) {
  try {
    const { walletAddress } = await request.json();
    const lobbyId = context?.params?.id;

    console.log(`🚀 JOIN LOBBY API: lobbyId=${lobbyId}, walletAddress=${walletAddress?.slice(0, 8)}...`);

    if (!walletAddress || !lobbyId) {
      console.error(`❌ Missing required fields: walletAddress=${!!walletAddress}, lobbyId=${!!lobbyId}`);
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
        g.game_type,
        g.max_players,
        g.entry_fee,
        g.status,
        COUNT(gp.player_id) as current_players,
        creator.username as creator_name
      FROM games g
      LEFT JOIN game_players gp ON g.id = gp.game_id
      LEFT JOIN players creator ON g.creator_id = creator.id
      WHERE g.id = ${lobbyId}
      GROUP BY g.id, g.game_type, g.max_players, g.entry_fee, g.status, creator.username
    `;

    if (lobbyResult.length === 0) {
      return NextResponse.json({ error: 'Lobby not found' }, { status: 404 });
    }

    const lobby = lobbyResult[0];

    console.log(`🔍 Lobby details:`, {
      status: lobby.status,
      currentPlayers: lobby.current_players,
      maxPlayers: lobby.max_players,
      gameType: lobby.game_type
    });

    if (lobby.status !== 'waiting') {
      console.error(`❌ Lobby not accepting players - status: ${lobby.status}`);
      return NextResponse.json({ 
        error: `Lobby is not accepting players (status: ${lobby.status})`,
        details: { actualStatus: lobby.status, expectedStatus: 'waiting' }
      }, { status: 400 });
    }

    if (lobby.current_players >= lobby.max_players) {
      console.error(`❌ Lobby full - current: ${lobby.current_players}, max: ${lobby.max_players}`);
      return NextResponse.json({ 
        error: `Lobby is full (${lobby.current_players}/${lobby.max_players})`,
        details: { currentPlayers: lobby.current_players, maxPlayers: lobby.max_players }
      }, { status: 400 });
    }

    // Check if player is already in the lobby
    const existingPlayerResult = await db`
      SELECT game_status FROM game_players 
      WHERE game_id = ${lobbyId} AND player_id = ${playerId}
    `;

    if (existingPlayerResult.length > 0) {
      const existingStatus = existingPlayerResult[0].game_status;
      
      // If player is already in the lobby (any status), just return success
      // This allows them to re-enter the lobby page
      return NextResponse.json({ 
        success: true, 
        message: existingStatus === 'ready' 
          ? 'You are already ready in this lobby!' 
          : existingStatus === 'invited'
          ? 'Welcome back! Please pay the entry fee to become ready.'
          : 'Welcome back to the lobby!',
        entryFee: lobby.entry_fee,
        status: existingStatus
      });
    } else {
      // Add player to lobby with waiting status
      await db`
        INSERT INTO game_players (game_id, player_id, game_status)
        VALUES (${lobbyId}, ${playerId}, 'waiting')
      `;

      // Send SMS notification to the joining player if they have SMS enabled
      try {
        const playerInfo = await db`
          SELECT phone_number, username, sms_notifications_enabled 
          FROM players 
          WHERE id = ${playerId}
        `;

        if (playerInfo.length > 0 && playerInfo[0].phone_number && playerInfo[0].sms_notifications_enabled) {
          await smsService.sendGameInvitation(
            playerInfo[0].phone_number,
            lobby.creator_name,
            lobby.game_type,
            parseFloat(lobby.entry_fee),
            lobbyId
          );
          console.log(`📱 SMS invitation sent to ${playerInfo[0].username}`);
        }
      } catch (smsError) {
        console.error('Failed to send SMS notification:', smsError);
        // Don't fail the join operation if SMS fails
      }

      return NextResponse.json({ 
        success: true, 
        message: 'Joined lobby successfully. Please pay the entry fee to become ready.',
        entryFee: lobby.entry_fee,
        status: 'waiting'
      });
    }
  } catch (error) {
    console.error('Error joining lobby:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 