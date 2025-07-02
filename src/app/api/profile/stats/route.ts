import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/schema';

interface GameStat {
  game_type: string;
  result: string;
  amount: string | number;
  created_at: string;
  game_id: string;
  opponent_username: string;
  opponent_wallet: string;
}

interface AggregatedStats {
  games_played: number;
  games_won: number;
  total_winnings: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('wallet');

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    console.log(`📊 Fetching stats for wallet: ${walletAddress}`);

    // Get player ID
    const playerResult = await db`
      SELECT id FROM players WHERE wallet_address = ${walletAddress}
    `;

    if (playerResult.length === 0) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    const playerId = playerResult[0].id;

    // Get aggregated stats from player_stats table (only safe fields)
    let aggregatedStats: AggregatedStats = {
      games_played: 0,
      games_won: 0,
      total_winnings: 0
    };

    try {
      const aggregatedStatsResult = await db`
        SELECT 
          COALESCE(games_played, 0) as games_played,
          COALESCE(games_won, 0) as games_won,
          COALESCE(total_winnings, 0) as total_winnings
        FROM player_stats
        WHERE player_id = ${playerId}
      `;

      if (aggregatedStatsResult.length > 0) {
        const result = aggregatedStatsResult[0];
        aggregatedStats = {
          games_played: parseInt(result.games_played?.toString() || '0') || 0,
          games_won: parseInt(result.games_won?.toString() || '0') || 0,
          total_winnings: parseFloat(result.total_winnings?.toString() || '0') || 0
        };
      }
    } catch (aggregatedError) {
      console.warn('Error fetching aggregated stats, using defaults:', aggregatedError);
    }

    // Get individual game statistics for recent games
    let gameStatsResult: GameStat[] = [];
    try {
      const result = await db`
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
      gameStatsResult = result as GameStat[];
    } catch (gameStatsError) {
      console.warn('Error fetching game stats, using empty array:', gameStatsError);
    }

    // Calculate summary statistics safely
    const totalGames = aggregatedStats.games_played;
    const wins = aggregatedStats.games_won;
    const losses = Math.max(0, totalGames - wins);
    const totalWinnings = aggregatedStats.total_winnings;

    // Calculate current streak from recent games (safe fallback)
    let currentStreak = 0;
    let streakType = 'none';
    
    if (gameStatsResult.length > 0) {
      let streak = 0;
      const lastResult = gameStatsResult[0]?.result;
      
      for (const game of gameStatsResult) {
        if (game.result === lastResult) {
          streak++;
        } else {
          break;
        }
      }
      
      currentStreak = streak;
      streakType = lastResult === 'win' ? 'win' : lastResult === 'loss' ? 'loss' : 'none';
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
      const gameType = stat.game_type || 'unknown';
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
      const amount = parseFloat(stat.amount?.toString() || '0') || 0;
      
      if (stat.result === 'win') {
        gameTypeStats[gameType].wins++;
        gameTypeStats[gameType].winnings += Math.abs(amount);
      } else {
        gameTypeStats[gameType].losses++;
        gameTypeStats[gameType].lossAmount += Math.abs(amount);
      }
    });

    const responseData = {
      summary: {
        totalGames,
        wins,
        losses,
        winRate: totalGames > 0 ? (wins / totalGames * 100).toFixed(1) : '0.0',
        totalWinnings: totalWinnings.toFixed(4),
        totalLosses: '0.0000', // Not tracked separately yet
        netProfit: totalWinnings.toFixed(4),
        currentStreak: Math.abs(currentStreak),
        streakType,
        bestStreak: Math.abs(currentStreak) // Simplified for now
      },
      gameTypeStats,
      recentGames: gameStatsResult.slice(0, 10) // Last 10 games
    };

    console.log(`✅ Stats response for ${walletAddress}:`, responseData.summary);
    return NextResponse.json(responseData);

  } catch (error) {
    console.error('❌ Error fetching player stats:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });

    // Return safe fallback data instead of 500 error
    return NextResponse.json({
      summary: {
        totalGames: 0,
        wins: 0,
        losses: 0,
        winRate: '0.0',
        totalWinnings: '0.0000',
        totalLosses: '0.0000',
        netProfit: '0.0000',
        currentStreak: 0,
        streakType: 'none',
        bestStreak: 0
      },
      gameTypeStats: {},
      recentGames: []
    });
  }
} 