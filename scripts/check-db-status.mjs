#!/usr/bin/env node

import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

const db = neon(DATABASE_URL);

async function checkDBStatus() {
  try {
    console.log('🔍 Checking database status...\n');
    
    // Check recent games
    console.log('📊 RECENT GAMES:');
    const recentGames = await db`
      SELECT 
        g.id, 
        g.game_type, 
        g.status, 
        g.entry_fee, 
        g.ended_at,
        g.created_at
      FROM games g 
      ORDER BY g.created_at DESC 
      LIMIT 10
    `;
    
    console.table(recentGames);
    
    // Check game players for recent completed games
    console.log('\n🎮 RECENT GAME PLAYERS:');
    const gamePlayersData = await db`
      SELECT 
        gp.game_id,
        gp.is_winner,
        p.username,
        p.wallet_address,
        g.status,
        g.ended_at
      FROM game_players gp
      JOIN players p ON gp.player_id = p.id
      JOIN games g ON gp.game_id = g.id
      WHERE g.status = 'completed'
      ORDER BY g.ended_at DESC
      LIMIT 20
    `;
    
    console.table(gamePlayersData);
    
    // Check stats tables
    console.log('\n📈 PLAYER STATS COUNT:');
    const statsCount = await db`
      SELECT COUNT(*) as total_player_stats FROM player_stats WHERE games_played > 0
    `;
    console.log(`Player stats records with games: ${statsCount[0].total_player_stats}`);
    
    console.log('\n📈 GAME STATS COUNT:');
    const gameStatsCount = await db`
      SELECT COUNT(*) as total_game_stats FROM game_stats
    `;
    console.log(`Game stats records: ${gameStatsCount[0].total_game_stats}`);
    
    // Check recent players
    console.log('\n👥 RECENT PLAYERS:');
    const recentPlayers = await db`
      SELECT 
        id,
        username,
        wallet_address,
        phone_number,
        created_at
      FROM players 
      ORDER BY created_at DESC 
      LIMIT 5
    `;
    
    console.table(recentPlayers);
    
  } catch (error) {
    console.error('❌ Database check failed:', error);
  }
}

checkDBStatus(); 