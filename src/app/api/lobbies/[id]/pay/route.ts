/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/schema';
import { verifyTransaction } from '@/lib/solana';

export async function POST(
  request: NextRequest,
  context: any
) {
  try {
    const { walletAddress, transactionSignature } = await request.json();
    const lobbyId = context?.params?.id;

    console.log(`💰 Processing payment for lobby ${lobbyId}:`, {
      walletAddress,
      transactionSignature
    });

    if (!walletAddress || !lobbyId || !transactionSignature) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get player ID
    const playerResult = await db`
      SELECT id FROM players WHERE wallet_address = ${walletAddress}
    `;

    if (playerResult.length === 0) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    const playerId = playerResult[0].id;

    // Get lobby details
    const lobbyResult = await db`
      SELECT entry_fee, status FROM games WHERE id = ${lobbyId}
    `;

    if (lobbyResult.length === 0) {
      return NextResponse.json({ error: 'Lobby not found' }, { status: 404 });
    }

    const lobby = lobbyResult[0];

    if (lobby.status !== 'waiting') {
      return NextResponse.json({ error: 'Lobby is not accepting payments' }, { status: 400 });
    }

    // Check if player is in the lobby
    const playerInLobbyResult = await db`
      SELECT game_status FROM game_players 
      WHERE game_id = ${lobbyId} AND player_id = ${playerId}
    `;

    if (playerInLobbyResult.length === 0) {
      return NextResponse.json({ error: 'Player not in lobby' }, { status: 400 });
    }

    const currentStatus = playerInLobbyResult[0].game_status;

    if (currentStatus === 'ready') {
      return NextResponse.json({ error: 'Already paid' }, { status: 400 });
    }

    // Verify the Solana transaction
    console.log(`🔍 Verifying transaction: ${transactionSignature}`);
    const isValidTransaction = await verifyTransaction(transactionSignature);
    
    if (!isValidTransaction) {
      console.log(`❌ Transaction verification failed: ${transactionSignature}`);
      return NextResponse.json({ 
        error: 'Invalid transaction signature' 
      }, { status: 400 });
    }

    console.log(`✅ Transaction verified: ${transactionSignature}`);

    // Update the database with payment confirmation
    await db`
      UPDATE game_players 
      SET game_status = 'ready'
      WHERE game_id = ${lobbyId} AND player_id = ${playerId}
    `;

    console.log(`✅ Player ${walletAddress} marked as ready in lobby ${lobbyId}`);

    // Check how many players are now ready
    const readyPlayersResult = await db`
      SELECT COUNT(*) as ready_count FROM game_players 
      WHERE game_id = ${lobbyId} AND game_status = 'ready'
    `;

    const readyCount = readyPlayersResult[0].ready_count;

    return NextResponse.json({ 
      success: true, 
      message: `Payment verified and confirmed! You are now ready to play. (${readyCount} players ready)`,
      entryFee: lobby.entry_fee,
      transactionSignature: transactionSignature,
      readyCount: readyCount
    });
  } catch (error) {
    console.error('Error processing payment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 