/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/schema';
import { processWinnerPayout, calculatePlatformFee } from '@/lib/solana';

export async function POST(
  request: NextRequest,
  context: any
) {
  try {
    const gameId = context?.params?.id;

    if (!gameId) {
      return NextResponse.json({ error: 'Game ID is required' }, { status: 400 });
    }

    // Get game details and winner
    const gameResult = await db`
      SELECT 
        g.id,
        g.game_type,
        g.entry_fee,
        g.max_players,
        COUNT(gp.player_id) as player_count,
        COUNT(CASE WHEN gp.is_winner = true THEN 1 END) as winner_count
      FROM games g
      LEFT JOIN game_players gp ON g.id = gp.game_id
      WHERE g.id = ${gameId}
      GROUP BY g.id, g.game_type, g.entry_fee, g.max_players
    `;

    if (gameResult.length === 0) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    const game = gameResult[0];

    // Check if game is completed
    if (game.winner_count === 0) {
      return NextResponse.json({ error: 'Game is not completed or no winner declared' }, { status: 400 });
    }

    // Get winner details
    const winnerResult = await db`
      SELECT 
        p.wallet_address,
        p.username
      FROM game_players gp
      JOIN players p ON gp.player_id = p.id
      WHERE gp.game_id = ${gameId} AND gp.is_winner = true
    `;

    if (winnerResult.length === 0) {
      return NextResponse.json({ error: 'Winner not found' }, { status: 404 });
    }

    const winner = winnerResult[0];

    // Calculate total pot (entry fee * number of players)
    const totalPot = game.entry_fee * game.player_count;
    const platformFee = calculatePlatformFee(totalPot);

    // Process winner payout (platform fee is calculated automatically)
    const payoutResult = await processWinnerPayout(winner.wallet_address, totalPot, gameId);
    
    if (!payoutResult.success) {
      return NextResponse.json({ 
        error: 'Payout failed', 
        details: payoutResult.error 
      }, { status: 500 });
    }

    const winnerAmount = payoutResult.amount || (totalPot - platformFee);

    // Update game status to completed with payout info
    await db`
      UPDATE games 
      SET 
        status = 'completed',
        ended_at = CURRENT_TIMESTAMP
      WHERE id = ${gameId}
    `;

    // Store payout transaction details
    await db`
      INSERT INTO game_payouts (game_id, winner_wallet, amount, transaction_signature)
      VALUES (${gameId}, ${winner.wallet_address}, ${winnerAmount}, ${payoutResult.signature})
    `;

    return NextResponse.json({ 
      success: true, 
      message: `Winner payout successful! ${winner.username} received ${winnerAmount} SOL`,
      winner: winner.username,
      amount: winnerAmount,
      transactionSignature: payoutResult.signature,
      totalPot: totalPot,
      platformFee: platformFee
    });
  } catch (error) {
    console.error('Error processing winner payout:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 