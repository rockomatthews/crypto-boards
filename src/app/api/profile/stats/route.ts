/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/schema';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('wallet');

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    // Get player ID
    const playerResult = await db`
      SELECT id FROM players WHERE wallet_address = ${walletAddress}
    `;

    if (playerResult.length === 0) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    const playerId = playerResult[0].id;

    // Get game statistics
    const statsResult = await db`
      SELECT 
        gs.game_type,
        gs.result,
        gs.amount,
        gs.created_at,
        g.id as game_id,
        opponent.username as opponent_username,
        opponent.wallet_address as opponent_wallet
      FROM game_stats gs
      JOIN games g ON gs.game_id = g.id
      JOIN players opponent ON gs.opponent_id = opponent.id
      WHERE gs.player_id = ${playerId}
      ORDER BY gs.created_at DESC
    `;

    // Calculate summary statistics
    const totalGames = statsResult.length;
    const wins = statsResult.filter(s => s.result === 'win').length;
    const losses = statsResult.filter(s => s.result === 'loss').length;
    const totalWinnings = statsResult
      .filter(s => s.result === 'win')
      .reduce((sum, s) => sum + parseFloat(s.amount), 0);
    const totalLosses = statsResult
      .filter(s => s.result === 'loss')
      .reduce((sum, s) => sum + parseFloat(s.amount), 0);

    // Calculate current streak
    let currentStreak = 0;
    let streakType = 'none';
    
    if (statsResult.length > 0) {
      const latestResult = statsResult[0].result;
      streakType = latestResult;
      
      for (const game of statsResult) {
        if (game.result === latestResult) {
          currentStreak++;
        } else {
          break;
        }
      }
    }

    // Group by game type
    const gameTypeStats: Record<string, {
      total: number;
      wins: number;
      losses: number;
      winnings: number;
      lossAmount: number;
    }> = {};
    
    statsResult.forEach(stat => {
      const gameType = stat.game_type;
      if (!gameTypeStats[gameType]) {
        gameTypeStats[gameType] = {
          total: 0,
          wins: 0,
          losses: 0,
          winnings: 0,
          lossAmount: 0
        };
      }
      
      gameTypeStats[gameType].total++;
      if (stat.result === 'win') {
        gameTypeStats[gameType].wins++;
        gameTypeStats[gameType].winnings += parseFloat(stat.amount);
      } else {
        gameTypeStats[gameType].losses++;
        gameTypeStats[gameType].lossAmount += parseFloat(stat.amount);
      }
    });

    return NextResponse.json({
      summary: {
        totalGames,
        wins,
        losses,
        winRate: totalGames > 0 ? (wins / totalGames * 100).toFixed(1) : '0.0',
        totalWinnings: totalWinnings.toFixed(4),
        totalLosses: totalLosses.toFixed(4),
        netProfit: (totalWinnings - totalLosses).toFixed(4),
        currentStreak,
        streakType
      },
      gameTypeStats,
      recentGames: statsResult.slice(0, 10) // Last 10 games
    });

  } catch (error) {
    console.error('Error fetching player stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 