/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/schema';
import { processWinnerPayout } from '@/lib/solana';

export async function POST(
  request: NextRequest,
  context: any
) {
  try {
    const gameId = context?.params?.id;
    
    if (!gameId) {
      return NextResponse.json({ error: 'Game ID is required' }, { status: 400 });
    }

    const body = await request.json();
    const { winnerId, gameType } = body;

    if (!winnerId || !gameType) {
      return NextResponse.json({ error: 'Missing required fields: winnerId and gameType' }, { status: 400 });
    }

    console.log(`🏆 Processing game completion for game ${gameId}, winner: ${winnerId}`);

    // Get game details - remove status restriction to allow 'completed' games too
    const gameResult = await db`
      SELECT 
        g.id,
        g.game_type,
        g.status,
        g.entry_fee,
        g.created_at
      FROM games g
      WHERE g.id = ${gameId}
    `;

    if (gameResult.length === 0) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    const game = gameResult[0];
    console.log(`Game found: status=${game.status}, entry_fee=${game.entry_fee}`);

    // Get all players in the game - don't restrict to only 'active' status
    const playersResult = await db`
      SELECT 
        p.id,
        p.username,
        p.wallet_address,
        gp.game_status
      FROM game_players gp
      JOIN players p ON gp.player_id = p.id
      WHERE gp.game_id = ${gameId}
      ORDER BY gp.joined_at ASC
    `;

    console.log(`Found ${playersResult.length} players:`, playersResult.map(p => ({ id: p.id, status: p.game_status })));

    if (playersResult.length !== 2) {
      return NextResponse.json({ error: `Game must have exactly 2 players, found: ${playersResult.length}` }, { status: 400 });
    }

    const winner = playersResult.find(p => p.id === winnerId);
    const loser = playersResult.find(p => p.id !== winnerId);

    if (!winner || !loser) {
      return NextResponse.json({ error: 'Invalid winner ID or players not found' }, { status: 400 });
    }

    console.log(`Winner: ${winner.username} (${winner.wallet_address})`);
    console.log(`Loser: ${loser.username} (${loser.wallet_address})`);

    // Calculate payout amount with platform fee
    const totalPot = parseFloat(game.entry_fee) * 2;
    const platformFee = totalPot * 0.04;
    const winnerPayout = totalPot - platformFee;

    console.log(`Total pot: ${totalPot} SOL, Platform fee: ${platformFee} SOL, Winner gets: ${winnerPayout} SOL`);

    try {
      // Process the actual SOL payout using the updated Solana function
      const payoutResult = await processWinnerPayout(winner.wallet_address, totalPot, gameId);
      
      if (!payoutResult.success) {
        console.error('Payout failed:', payoutResult.error);
        return NextResponse.json({ 
          error: 'Payout failed', 
          details: payoutResult.error 
        }, { status: 500 });
      }

      console.log(`✅ Payout successful: ${payoutResult.signature}`);

      // Update database - execute all updates
      // Update game status to completed
      await db`
        UPDATE games 
        SET status = 'completed', ended_at = CURRENT_TIMESTAMP
        WHERE id = ${gameId}
      `;

      // Update game_players to mark winner and loser
      await db`
        UPDATE game_players 
        SET is_winner = true, game_status = 'completed'
        WHERE game_id = ${gameId} AND player_id = ${winnerId}
      `;

      await db`
        UPDATE game_players 
        SET is_winner = false, game_status = 'completed'
        WHERE game_id = ${gameId} AND player_id = ${loser.id}
      `;

      // Record payout in game_payouts table
      try {
        await db`
          INSERT INTO game_payouts (game_id, winner_wallet, amount, transaction_signature)
          VALUES (${gameId}, ${winner.wallet_address}, ${winnerPayout}, ${payoutResult.signature})
        `;
      } catch (payoutInsertError) {
        console.warn('Failed to insert payout record:', payoutInsertError);
        // Continue execution - this is not critical for game completion
      }

      // Update player stats (with error handling)
      try {
        // Ensure player_stats table exists and initialize stats if needed
        await db`
          INSERT INTO player_stats (player_id, games_played, games_won, total_winnings)
          VALUES (${winnerId}, 0, 0, 0)
          ON CONFLICT (player_id) DO NOTHING
        `;

        await db`
          INSERT INTO player_stats (player_id, games_played, games_won, total_winnings)
          VALUES (${loser.id}, 0, 0, 0)
          ON CONFLICT (player_id) DO NOTHING
        `;

        // Update winner stats
        await db`
          UPDATE player_stats 
          SET 
            games_played = games_played + 1,
            games_won = games_won + 1,
            total_winnings = total_winnings + ${winnerPayout},
            updated_at = CURRENT_TIMESTAMP
          WHERE player_id = ${winnerId}
        `;

        // Update loser stats
        await db`
          UPDATE player_stats 
          SET 
            games_played = games_played + 1,
            updated_at = CURRENT_TIMESTAMP
          WHERE player_id = ${loser.id}
        `;

        console.log('✅ Player stats updated successfully');

        // Try to create game_stats records
        try {
          await db`
            INSERT INTO game_stats (game_id, player_id, opponent_id, game_type, result, amount)
            VALUES (${gameId}, ${winnerId}, ${loser.id}, ${gameType}, 'win', ${winnerPayout})
          `;

          await db`
            INSERT INTO game_stats (game_id, player_id, opponent_id, game_type, result, amount)
            VALUES (${gameId}, ${loser.id}, ${winnerId}, ${gameType}, 'loss', ${parseFloat(game.entry_fee)})
          `;

          console.log('✅ Game stats recorded successfully');
        } catch (gameStatsError) {
          console.warn('Failed to insert game stats (table may not exist):', gameStatsError);
          // Continue execution - this is not critical
        }

      } catch (statsError) {
        console.warn('Failed to update player stats (tables may not exist):', statsError);
        // Continue execution - this is not critical for game completion
      }

      console.log(`🎉 Game completion successful for game ${gameId}`);

      return NextResponse.json({ 
        success: true,
        message: 'Game completed successfully',
        winner: winner.username,
        payout: winnerPayout,
        platformFee: platformFee,
        totalPot: totalPot,
        transactionSignature: payoutResult.signature
      });

    } catch (payoutError) {
      console.error('Error processing payout:', payoutError);
      return NextResponse.json({ error: 'Failed to process payout' }, { status: 500 });
    }

  } catch (error) {
    console.error('Error completing game:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 