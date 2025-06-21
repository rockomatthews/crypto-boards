/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/schema';
import { processRefund } from '@/lib/solana';

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
      SELECT 
        g.id,
        g.status,
        g.entry_fee,
        g.creator_id,
        p.wallet_address as creator_wallet
      FROM games g
      JOIN players p ON g.creator_id = p.id
      WHERE g.id = ${lobbyId}
    `;

    if (lobbyResult.length === 0) {
      return NextResponse.json({ error: 'Lobby not found' }, { status: 404 });
    }

    const lobby = lobbyResult[0];

    // Check if game has already started
    if (lobby.status === 'in_progress' || lobby.status === 'completed') {
      return NextResponse.json({ 
        error: 'Cannot cancel game that has already started or completed' 
      }, { status: 400 });
    }

    // Check if player is the creator or a participant
    const isCreator = lobby.creator_id === playerId;
    
    if (isCreator) {
      // Creator is canceling the entire game
      return await cancelEntireGame(lobbyId, lobby.entry_fee);
    } else {
      // Player is leaving the game
      return await cancelPlayerParticipation(lobbyId, playerId, walletAddress, lobby.entry_fee);
    }
  } catch (error) {
    console.error('Error canceling game:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function cancelEntireGame(lobbyId: string, entryFee: number) {
  try {
    // Get all players who have paid (status = 'ready')
    const paidPlayersResult = await db`
      SELECT 
        p.wallet_address,
        gp.player_id
      FROM game_players gp
      JOIN players p ON gp.player_id = p.id
      WHERE gp.game_id = ${lobbyId} AND gp.game_status = 'ready'
    `;

    const refunds = [];
    
    // Process refunds for all paid players
    for (const player of paidPlayersResult) {
      const refundResult = await processRefund(player.wallet_address, entryFee);
      
      if (refundResult.success) {
        // Record the refund in database
        await db`
          INSERT INTO game_refunds (game_id, player_wallet, amount, transaction_signature)
          VALUES (${lobbyId}, ${player.wallet_address}, ${entryFee}, ${refundResult.signature})
        `;
        
        refunds.push({
          wallet: player.wallet_address,
          amount: entryFee,
          signature: refundResult.signature
        });
      }
    }

    // Delete the game and all related data
    await db`DELETE FROM game_players WHERE game_id = ${lobbyId}`;
    await db`DELETE FROM game_states WHERE game_id = ${lobbyId}`;
    await db`DELETE FROM games WHERE id = ${lobbyId}`;

    return NextResponse.json({
      success: true,
      message: 'Game canceled successfully',
      refunds: refunds
    });
  } catch (error) {
    console.error('Error canceling entire game:', error);
    throw error;
  }
}

async function cancelPlayerParticipation(
  lobbyId: string, 
  playerId: string, 
  walletAddress: string, 
  entryFee: number
) {
  try {
    // Check if player is in the lobby
    const playerInLobbyResult = await db`
      SELECT game_status FROM game_players 
      WHERE game_id = ${lobbyId} AND player_id = ${playerId}
    `;

    if (playerInLobbyResult.length === 0) {
      return NextResponse.json({ error: 'Player not in lobby' }, { status: 400 });
    }

    const playerStatus = playerInLobbyResult[0].game_status;
    let refundResult = null;

    // If player has paid, process refund
    if (playerStatus === 'ready') {
      refundResult = await processRefund(walletAddress, entryFee);
      
      if (refundResult.success) {
        // Record the refund in database
        await db`
          INSERT INTO game_refunds (game_id, player_wallet, amount, transaction_signature)
          VALUES (${lobbyId}, ${walletAddress}, ${entryFee}, ${refundResult.signature})
        `;
      }
    }

    // Remove player from the game
    await db`
      DELETE FROM game_players 
      WHERE game_id = ${lobbyId} AND player_id = ${playerId}
    `;

    return NextResponse.json({
      success: true,
      message: 'Successfully left the game',
      refund: refundResult ? {
        amount: entryFee,
        signature: refundResult.signature
      } : null
    });
  } catch (error) {
    console.error('Error canceling player participation:', error);
    throw error;
  }
} 