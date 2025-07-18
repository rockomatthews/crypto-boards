#!/usr/bin/env node

import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

const db = neon(DATABASE_URL);

async function migrateGameStats() {
  try {
    console.log('🔄 Starting game stats migration...');
    
    // Step 1: Get all completed games with player information
    console.log('📊 Fetching completed games...');
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

    console.log(`✅ Found ${completedGames.length} completed game records`);

    if (completedGames.length === 0) {
      console.log('⚠️ No completed games found to migrate');
      return;
    }

    // Step 2: Process games and create game_stats records
    console.log('📝 Creating game_stats records...');
    
    // Group by game to get winner/loser pairs
    const gameGroups = new Map();
    completedGames.forEach(record => {
      if (!gameGroups.has(record.game_id)) {
        gameGroups.set(record.game_id, []);
      }
      gameGroups.get(record.game_id).push(record);
    });

    let gameStatsCreated = 0;
    
    for (const [gameId, players] of gameGroups) {
      if (players.length !== 2) {
        console.warn(`⚠️ Skipping game ${gameId} - has ${players.length} players instead of 2`);
        continue;
      }

      const winner = players.find(p => p.is_winner === true);
      const loser = players.find(p => p.is_winner === false);

      if (!winner || !loser) {
        console.warn(`⚠️ Skipping game ${gameId} - missing winner or loser`);
        continue;
      }

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
          console.log(`✅ Created stats for game ${gameId}: ${winner.username} (win) vs ${loser.username} (loss)`);
        } else {
          console.log(`⏭️ Stats already exist for game ${gameId}`);
        }
      } catch (gameStatsError) {
        console.error(`❌ Error creating game stats for ${gameId}:`, gameStatsError);
      }
    }

    console.log(`✅ Created ${gameStatsCreated} game_stats records`);

    // Step 3: Calculate and update player_stats
    console.log('📊 Calculating player statistics...');
    
    const playerStatsQuery = await db`
      SELECT 
        gs.player_id,
        COUNT(*) as games_played,
        COUNT(CASE WHEN gs.result = 'win' THEN 1 END) as games_won,
        COALESCE(SUM(CASE WHEN gs.result = 'win' THEN gs.amount ELSE 0 END), 0) as total_winnings
      FROM game_stats gs
      GROUP BY gs.player_id
    `;

    console.log(`✅ Calculated stats for ${playerStatsQuery.length} players`);

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
        console.error(`❌ Error updating player stats for ${playerStat.player_id}:`, playerStatsError);
      }
    }

    console.log(`✅ Updated ${playerStatsUpdated} player_stats records`);

    // Step 4: Verify migration results
    console.log('🔍 Verifying migration results...');
    
    const finalStats = await db`
      SELECT 
        (SELECT COUNT(*) FROM game_stats) as game_stats_count,
        (SELECT COUNT(*) FROM player_stats WHERE games_played > 0) as active_player_stats_count,
        (SELECT COUNT(DISTINCT game_id) FROM game_stats) as games_with_stats,
        (SELECT COUNT(*) FROM games WHERE status = 'completed') as completed_games_count
    `;

    const stats = finalStats[0];
    console.log('\n📊 Migration Summary:');
    console.log(`   Game Stats Records: ${stats.game_stats_count}`);
    console.log(`   Active Player Stats: ${stats.active_player_stats_count}`);
    console.log(`   Games with Stats: ${stats.games_with_stats}`);
    console.log(`   Total Completed Games: ${stats.completed_games_count}`);

    // Step 5: Show sample data
    console.log('\n🎮 Sample Player Statistics:');
    const sampleStats = await db`
      SELECT 
        p.username,
        p.wallet_address,
        ps.games_played,
        ps.games_won,
        ps.total_winnings
      FROM player_stats ps
      JOIN players p ON ps.player_id = p.id
      WHERE ps.games_played > 0
      ORDER BY ps.total_winnings DESC
      LIMIT 5
    `;

    sampleStats.forEach(stat => {
      console.log(`   ${stat.username}: ${stat.games_won}/${stat.games_played} wins, ${stat.total_winnings} SOL`);
    });

    console.log('\n🎉 Stats migration completed successfully!');

  } catch (error) {
    console.error('❌ Error during stats migration:', error);
    process.exit(1);
  }
}

migrateGameStats(); 