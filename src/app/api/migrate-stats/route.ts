import { NextResponse } from 'next/server';
import { db } from '@/lib/db/schema';

export async function POST() {
  try {
    console.log('🔄 Starting game stats migration via API...');

    // Step 1: Get all completed games with player information
    const completedGames = await db`
      SELECT 
        g.id as game_id,
        g.game_type,
        g.entry_fee,
        g.ended_at,
        gp.player_id,
        gp.is_winner,
        p.wallet_address,
        p.username
      FROM games g
      JOIN game_players gp ON g.id = gp.game_id
      JOIN players p ON gp.player_id = p.id
      WHERE g.status = 'completed' 
        AND g.ended_at IS NOT NULL
        AND gp.is_winner IS NOT NULL
      ORDER BY g.ended_at ASC
    `;

    if (completedGames.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No completed games found to migrate',
        stats: { gamesFound: 0, statsCreated: 0, playersUpdated: 0 }
      });
    }

    // Step 2: Process games and create game_stats records
    const gameGroups = new Map();
    completedGames.forEach(record => {
      if (!gameGroups.has(record.game_id)) {
        gameGroups.set(record.game_id, []);
      }
      gameGroups.get(record.game_id).push(record);
    });

    let gameStatsCreated = 0;
    const processedGames = [];

    for (const [gameId, players] of gameGroups) {
      if (players.length !== 2) continue;

      const winner = players.find(p => p.is_winner === true);
      const loser = players.find(p => p.is_winner === false);

      if (!winner || !loser) continue;

      const entryFee = parseFloat(winner.entry_fee);
      const winnerAmount = entryFee * 2 * 0.96; // 96% to winner
      const loserAmount = -entryFee; // Lost entry fee

      try {
        // Check if game_stats already exist for this game
        const existingStats = await db`
          SELECT id FROM game_stats WHERE game_id = ${gameId}
        `;

        if (existingStats.length === 0) {
          // Create winner stats
          await db`
            INSERT INTO game_stats (game_id, player_id, game_type, result, amount, opponent_id, created_at)
            VALUES (${gameId}, ${winner.player_id}, ${winner.game_type}, 'win', ${winnerAmount}, ${loser.player_id}, ${winner.ended_at})
          `;

          // Create loser stats
          await db`
            INSERT INTO game_stats (game_id, player_id, game_type, result, amount, opponent_id, created_at)
            VALUES (${gameId}, ${loser.player_id}, ${loser.game_type}, 'loss', ${loserAmount}, ${winner.player_id}, ${loser.ended_at})
          `;

          gameStatsCreated += 2;
          processedGames.push({
            gameId,
            winner: winner.username,
            loser: loser.username,
            entryFee,
            winnerAmount
          });
        }
      } catch (gameStatsError) {
        console.error(`Error creating game stats for ${gameId}:`, gameStatsError);
      }
    }

    // Step 3: Calculate and update player_stats
    const playerStatsQuery = await db`
      SELECT 
        gs.player_id,
        COUNT(*) as games_played,
        COUNT(CASE WHEN gs.result = 'win' THEN 1 END) as games_won,
        COALESCE(SUM(CASE WHEN gs.result = 'win' THEN gs.amount ELSE 0 END), 0) as total_winnings
      FROM game_stats gs
      GROUP BY gs.player_id
    `;

    let playerStatsUpdated = 0;

    for (const playerStat of playerStatsQuery) {
      try {
        await db`
          INSERT INTO player_stats (player_id, games_played, games_won, total_winnings)
          VALUES (${playerStat.player_id}, ${playerStat.games_played}, ${playerStat.games_won}, ${playerStat.total_winnings})
          ON CONFLICT (player_id) DO UPDATE SET
            games_played = ${playerStat.games_played},
            games_won = ${playerStat.games_won},
            total_winnings = ${playerStat.total_winnings},
            updated_at = CURRENT_TIMESTAMP
        `;
        
        playerStatsUpdated++;
      } catch (playerStatsError) {
        console.error(`Error updating player stats for ${playerStat.player_id}:`, playerStatsError);
      }
    }

    // Step 4: Get verification stats
    const finalStats = await db`
      SELECT 
        (SELECT COUNT(*) FROM game_stats) as game_stats_count,
        (SELECT COUNT(*) FROM player_stats WHERE games_played > 0) as active_player_stats_count,
        (SELECT COUNT(DISTINCT game_id) FROM game_stats) as games_with_stats,
        (SELECT COUNT(*) FROM games WHERE status = 'completed') as completed_games_count
    `;

    const verificationStats = finalStats[0];

    return NextResponse.json({
      success: true,
      message: 'Stats migration completed successfully',
      stats: {
        completedGamesFound: completedGames.length,
        gameStatsCreated,
        playerStatsUpdated,
        finalCounts: {
          gameStatsTotal: parseInt(verificationStats.game_stats_count),
          activePlayerStats: parseInt(verificationStats.active_player_stats_count),
          gamesWithStats: parseInt(verificationStats.games_with_stats),
          totalCompletedGames: parseInt(verificationStats.completed_games_count)
        }
      },
      processedGames: processedGames.slice(0, 10) // Show first 10 for verification
    });

  } catch (error) {
    console.error('Error during stats migration:', error);
    return NextResponse.json({ 
      error: 'Migration failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
} 