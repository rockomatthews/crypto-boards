/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/schema';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');

    // Get recent completed games with player details
    const feedResult = await db`
      SELECT 
        g.id,
        g.game_type,
        g.entry_fee,
        g.ended_at,
        winner.username as winner_username,
        winner.wallet_address as winner_wallet,
        loser.username as loser_username,
        loser.wallet_address as loser_wallet,
        payout.amount as payout_amount
      FROM games g
      JOIN game_players gp_winner ON g.id = gp_winner.game_id AND gp_winner.is_winner = true
      JOIN game_players gp_loser ON g.id = gp_loser.game_id AND gp_loser.is_winner = false
      JOIN players winner ON gp_winner.player_id = winner.id
      JOIN players loser ON gp_loser.player_id = loser.id
      LEFT JOIN game_payouts payout ON g.id = payout.game_id
      WHERE g.status = 'completed'
      ORDER BY g.ended_at DESC
      LIMIT ${limit}
    `;

    const feed = feedResult.map(game => ({
      id: game.id,
      gameType: game.game_type,
      entryFee: parseFloat(game.entry_fee),
      payoutAmount: game.payout_amount ? parseFloat(game.payout_amount) : null,
      endedAt: game.ended_at,
      winner: {
        username: game.winner_username,
        wallet: game.winner_wallet
      },
      loser: {
        username: game.loser_username,
        wallet: game.loser_wallet
      }
    }));

    return NextResponse.json({ feed });

  } catch (error) {
    console.error('Error fetching game feed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 