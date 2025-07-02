import { NextResponse } from 'next/server';
import { db } from '@/lib/db/schema';

interface GamePlayerRecord {
  game_id: string;
  game_type: string;
  status: string;
  entry_fee: string;
  ended_at: string;
  player_id: string;
  is_winner: boolean | null;
  player_status: string;
  username: string;
  wallet_address: string;
}

export async function GET() {
  try {
    console.log('🔍 Debugging game completion data...');

    // Check all completed games and their players
    const completedGamesDebug = await db`
      SELECT 
        g.id as game_id,
        g.game_type,
        g.status,
        g.entry_fee,
        g.ended_at,
        gp.player_id,
        gp.is_winner,
        gp.game_status as player_status,
        p.username,
        p.wallet_address
      FROM games g
      LEFT JOIN game_players gp ON g.id = gp.game_id
      LEFT JOIN players p ON gp.player_id = p.id
      WHERE g.status = 'completed'
      ORDER BY g.ended_at DESC, g.id, gp.player_id
    `;

    const typedGames = completedGamesDebug as GamePlayerRecord[];

    // Group by game to see winner/loser pairs
    const gameGroups = new Map<string, GamePlayerRecord[]>();
    typedGames.forEach(record => {
      if (!gameGroups.has(record.game_id)) {
        gameGroups.set(record.game_id, []);
      }
      gameGroups.get(record.game_id)?.push(record);
    });

    const analysis = [];
    let gamesWithWinners = 0;
    let gamesWithoutWinners = 0;

    for (const [gameId, players] of gameGroups) {
      const hasWinner = players.some((p: GamePlayerRecord) => p.is_winner === true);
      const hasLoser = players.some((p: GamePlayerRecord) => p.is_winner === false);
      const hasNullWinners = players.some((p: GamePlayerRecord) => p.is_winner === null);

      if (hasWinner && hasLoser) {
        gamesWithWinners++;
      } else {
        gamesWithoutWinners++;
      }

      analysis.push({
        gameId,
        playerCount: players.length,
        hasWinner,
        hasLoser,
        hasNullWinners,
        players: players.map((p: GamePlayerRecord) => ({
          username: p.username,
          wallet: p.wallet_address?.slice(0, 8),
          is_winner: p.is_winner,
          player_status: p.player_status
        }))
      });
    }

    // Check recent game completion calls
    console.log('📊 Analysis complete');

    return NextResponse.json({
      totalCompletedGames: typedGames.length,
      uniqueGames: gameGroups.size,
      gamesWithWinners,
      gamesWithoutWinners,
      analysis: analysis.slice(0, 10), // Show first 10 games
      summary: {
        message: gamesWithoutWinners > 0 
          ? `${gamesWithoutWinners} games are missing winner data` 
          : 'All games have proper winner data'
      }
    });

  } catch (error) {
    console.error('Error debugging games:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Debug failed', details: errorMessage }, { status: 500 });
  }
} 