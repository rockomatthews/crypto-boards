/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/schema';
import { processSolPayment } from '@/lib/solana';

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

    // Process real SOL payment
    const paymentResult = await processSolPayment(walletAddress, lobby.entry_fee);
    
    if (!paymentResult.success) {
      return NextResponse.json({ 
        error: 'Payment failed', 
        details: paymentResult.error 
      }, { status: 400 });
    }

    // Update the database with payment confirmation
    await db`
      UPDATE game_players 
      SET game_status = 'ready'
      WHERE game_id = ${lobbyId} AND player_id = ${playerId}
    `;

    return NextResponse.json({ 
      success: true, 
      message: 'Payment successful! You are now ready to play.',
      entryFee: lobby.entry_fee,
      transactionSignature: paymentResult.signature
    });
  } catch (error) {
    console.error('Error processing payment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 