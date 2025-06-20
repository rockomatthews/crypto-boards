import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/schema';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const playerId = searchParams.get('playerId');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    let gamesResult;

    if (playerId) {
      // Get games for a specific player
      gamesResult = await db`
        SELECT 
          g.id,
          g.game_type,
          g.status,
          g.entry_fee,
          g.created_at,
          g.started_at,
          g.ended_at,
          gp.game_status,
          gp.is_winner,
          p.username as player_username,
          p.wallet_address as player_wallet,
          COUNT(gp2.player_id) as total_players,
          gp2.amount as payout_amount,
          gp2.transaction_signature as payout_signature
        FROM games g
        JOIN game_players gp ON g.id = gp.game_id
        JOIN players p ON gp.player_id = p.id
        LEFT JOIN game_players gp2 ON g.id = gp2.game_id
        LEFT JOIN game_payouts gp2 ON g.id = gp2.game_id
        WHERE gp.player_id = ${playerId}
        GROUP BY g.id, g.game_type, g.status, g.entry_fee, g.created_at, g.started_at, g.ended_at, 
                 gp.game_status, gp.is_winner, p.username, p.wallet_address, gp2.amount, gp2.transaction_signature
        ORDER BY g.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      // Get all completed games
      gamesResult = await db`
        SELECT 
          g.id,
          g.game_type,
          g.status,
          g.entry_fee,
          g.created_at,
          g.started_at,
          g.ended_at,
          COUNT(gp.player_id) as total_players,
          COUNT(CASE WHEN gp.is_winner = true THEN 1 END) as winner_count,
          MAX(gp2.amount) as total_payout,
          MAX(gp2.transaction_signature) as payout_signature
        FROM games g
        LEFT JOIN game_players gp ON g.id = gp.game_id
        LEFT JOIN game_payouts gp2 ON g.id = gp2.game_id
        WHERE g.status = 'completed'
        GROUP BY g.id, g.game_type, g.status, g.entry_fee, g.created_at, g.started_at, g.ended_at
        ORDER BY g.ended_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }

    // Get player statistics if playerId is provided
    let playerStats = null;
    if (playerId) {
      const statsResult = await db`
        SELECT 
          COUNT(DISTINCT g.id) as total_games,
          COUNT(CASE WHEN gp.is_winner = true THEN 1 END) as wins,
          COUNT(CASE WHEN gp.is_winner = false AND g.status = 'completed' THEN 1 END) as losses,
          SUM(CASE WHEN gp.is_winner = true THEN gp2.amount ELSE 0 END) as total_winnings,
          SUM(g.entry_fee) as total_entry_fees,
          AVG(CASE WHEN g.ended_at IS NOT NULL THEN EXTRACT(EPOCH FROM (g.ended_at - g.started_at))/60 ELSE NULL END) as avg_game_duration_minutes
        FROM games g
        JOIN game_players gp ON g.id = gp.game_id
        LEFT JOIN game_payouts gp2 ON g.id = gp2.game_id AND gp2.winner_wallet = p.wallet_address
        JOIN players p ON gp.player_id = p.id
        WHERE gp.player_id = ${playerId} AND g.status = 'completed'
      `;
      
      if (statsResult.length > 0) {
        const stats = statsResult[0];
        playerStats = {
          totalGames: parseInt(stats.total_games) || 0,
          wins: parseInt(stats.wins) || 0,
          losses: parseInt(stats.losses) || 0,
          winRate: stats.total_games > 0 ? (stats.wins / stats.total_games * 100).toFixed(1) : '0.0',
          totalWinnings: parseFloat(stats.total_winnings) || 0,
          totalEntryFees: parseFloat(stats.total_entry_fees) || 0,
          netProfit: (parseFloat(stats.total_winnings) || 0) - (parseFloat(stats.total_entry_fees) || 0),
          avgGameDuration: parseFloat(stats.avg_game_duration_minutes) || 0
        };
      }
    }

    return NextResponse.json({
      games: gamesResult,
      playerStats,
      pagination: {
        limit,
        offset,
        hasMore: gamesResult.length === limit
      }
    });
  } catch (error) {
    console.error('Error fetching game history:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 