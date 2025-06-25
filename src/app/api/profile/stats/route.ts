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

    // Get aggregated stats from player_stats table
    const aggregatedStatsResult = await db`
      SELECT 
        games_played,
        games_won,
        total_winnings,
        total_losses,
        current_streak,
        best_streak,
        updated_at
      FROM player_stats
      WHERE player_id = ${playerId}
    `;

    // Get individual game statistics for recent games and detailed breakdown
    const gameStatsResult = await db`
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
      LIMIT 50
    `;

    // Calculate summary statistics
    const aggregatedStats = aggregatedStatsResult[0] || {
      games_played: 0,
      games_won: 0,
      total_winnings: 0,
      total_losses: 0,
      current_streak: 0,
      best_streak: 0
    };

    const totalGames = aggregatedStats.games_played;
    const wins = aggregatedStats.games_won;
    const losses = totalGames - wins;
    const totalWinnings = parseFloat(aggregatedStats.total_winnings);
    const totalLosses = parseFloat(aggregatedStats.total_losses);
    const currentStreak = aggregatedStats.current_streak;
    const bestStreak = aggregatedStats.best_streak;

    // Calculate streak type
    let streakType = 'none';
    if (currentStreak > 0) {
      streakType = 'win';
    } else if (currentStreak < 0) {
      streakType = 'loss';
    }

    // Group by game type from recent games
    const gameTypeStats: Record<string, {
      total: number;
      wins: number;
      losses: number;
      winnings: number;
      lossAmount: number;
    }> = {};
    
    gameStatsResult.forEach(stat => {
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
        currentStreak: Math.abs(currentStreak),
        streakType,
        bestStreak
      },
      gameTypeStats,
      recentGames: gameStatsResult.slice(0, 10) // Last 10 games
    });

  } catch (error) {
    console.error('Error fetching player stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 