import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/schema';

export async function POST(request: NextRequest) {
  try {
    const { gameType, entryFee, creatorWalletAddress, invitedPlayers, maxPlayers } = await request.json();

    if (!gameType || !entryFee || !creatorWalletAddress || !maxPlayers) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get or create the creator player
    const creatorResult = await db`
      INSERT INTO players (wallet_address, username, avatar_url)
      VALUES (${creatorWalletAddress}, ${`Player${creatorWalletAddress.slice(0, 4)}`}, '')
      ON CONFLICT (wallet_address) DO UPDATE SET
        last_login = CURRENT_TIMESTAMP
      RETURNING id
    `;

    if (creatorResult.length === 0) {
      return NextResponse.json({ error: 'Failed to create/find player' }, { status: 500 });
    }

    const creatorId = creatorResult[0].id;

    // Create the game
    const gameResult = await db`
      INSERT INTO games (game_type, status, max_players, entry_fee, creator_id, is_private)
      VALUES (${gameType}, 'waiting', ${maxPlayers}, ${entryFee}, ${creatorId}, ${invitedPlayers.length > 0})
      RETURNING id
    `;

    if (gameResult.length === 0) {
      return NextResponse.json({ error: 'Failed to create game' }, { status: 500 });
    }

    const gameId = gameResult[0].id;

    // Add creator to the game
    await db`
      INSERT INTO game_players (game_id, player_id, game_status)
      VALUES (${gameId}, ${creatorId}, 'waiting')
    `;

    // Create invitations for invited players
    if (invitedPlayers.length > 0) {
      for (const friendId of invitedPlayers) {
        await db`
          INSERT INTO game_players (game_id, player_id, game_status)
          VALUES (${gameId}, ${friendId}, 'invited')
        `;
      }
    }

    // Get the created lobby with player info
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
        p.wallet_address as creator_wallet,
        COUNT(gp.player_id) as current_players
      FROM games g
      JOIN players p ON g.creator_id = p.id
      LEFT JOIN game_players gp ON g.id = gp.game_id
      WHERE g.id = ${gameId}
      GROUP BY g.id, g.game_type, g.status, g.max_players, g.entry_fee, g.is_private, g.created_at, p.username, p.wallet_address
    `;

    if (lobbyResult.length > 0) {
      return NextResponse.json(lobbyResult[0]);
    } else {
      return NextResponse.json({ error: 'Failed to retrieve lobby' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error creating lobby:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const walletAddress = searchParams.get('walletAddress');

  if (!walletAddress) {
    return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
  }

  try {
    // First, cleanup empty lobbies and abandoned games
    console.log('🧹 Cleaning up empty lobbies...');
    
    // Delete lobbies that have no players
    const emptyLobbiesResult = await db`
      DELETE FROM games 
      WHERE status = 'waiting' 
      AND id NOT IN (
        SELECT DISTINCT game_id 
        FROM game_players 
        WHERE game_id IS NOT NULL
      )
      RETURNING id
    `;
    
    if (emptyLobbiesResult.length > 0) {
      console.log(`✅ Cleaned up ${emptyLobbiesResult.length} empty lobbies`);
    }

    // Also cleanup lobbies older than 1 hour with no activity
    const staleLobbiesResult = await db`
      DELETE FROM games 
      WHERE status = 'waiting' 
      AND created_at < NOW() - INTERVAL '1 hour'
      RETURNING id
    `;
    
    if (staleLobbiesResult.length > 0) {
      console.log(`✅ Cleaned up ${staleLobbiesResult.length} stale lobbies`);
    }

    // Get player ID
    const playerResult = await db`
      SELECT id FROM players WHERE wallet_address = ${walletAddress}
    `;

    if (playerResult.length === 0) {
      return NextResponse.json([]);
    }

    const playerId = playerResult[0].id;

    // Get lobbies where player is involved (creator, invited, or public)
    const lobbiesResult = await db`
      SELECT 
        g.id,
        g.game_type,
        g.status,
        g.max_players,
        g.entry_fee,
        g.is_private,
        g.created_at,
        p.username as creator_name,
        p.wallet_address as creator_wallet,
        COUNT(gp2.player_id) as current_players,
        gp.game_status as player_status
      FROM games g
      JOIN players p ON g.creator_id = p.id
      LEFT JOIN game_players gp ON g.id = gp.game_id AND gp.player_id = ${playerId}
      LEFT JOIN game_players gp2 ON g.id = gp2.game_id
      WHERE (g.status = 'waiting' OR (g.status = 'in_progress' AND gp.player_id = ${playerId}))
        AND (
          g.creator_id = ${playerId} 
          OR gp.player_id = ${playerId}
          OR (g.is_private = false AND g.creator_id != ${playerId} AND g.status = 'waiting')
        )
      GROUP BY g.id, g.game_type, g.status, g.max_players, g.entry_fee, g.is_private, g.created_at, p.username, p.wallet_address, gp.game_status
      HAVING COUNT(gp2.player_id) > 0
      ORDER BY g.created_at DESC
    `;

    // Convert entry_fee to number to prevent toFixed errors
    const lobbies = lobbiesResult.map(lobby => ({
      ...lobby,
      entry_fee: parseFloat(lobby.entry_fee),
      current_players: parseInt(lobby.current_players)
    }));

    return NextResponse.json(lobbies);
  } catch (error) {
    console.error('Error fetching lobbies:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 