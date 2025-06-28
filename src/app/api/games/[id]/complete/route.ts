/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/schema';
import { processWinnerPayout } from '@/lib/solana';
import smsService from '@/lib/sms';

export async function POST(
  request: NextRequest,
  context: any
) {
  try {
    const { winnerWallet, loserWallet } = await request.json();
    const gameId = context?.params?.id;

    if (!winnerWallet || !loserWallet || !gameId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    console.log(`🏁 Completing game ${gameId} - Winner: ${winnerWallet.slice(0, 8)}..., Loser: ${loserWallet.slice(0, 8)}...`);

    // Get game details
    const gameResult = await db`
      SELECT 
        g.id,
        g.game_type,
        g.entry_fee,
        g.status
      FROM games g
      WHERE g.id = ${gameId}
    `;

    if (gameResult.length === 0) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    const game = gameResult[0];

    if (game.status === 'completed') {
      return NextResponse.json({ error: 'Game already completed' }, { status: 400 });
    }

    // Get player information for SMS notifications
    const playersResult = await db`
      SELECT 
        p.wallet_address,
        p.username,
        p.phone_number,
        p.sms_notifications_enabled,
        gp.player_id
      FROM game_players gp
      JOIN players p ON gp.player_id = p.id
      WHERE gp.game_id = ${gameId}
    `;

    // Update game status
    await db`
      UPDATE games 
      SET status = 'completed', ended_at = CURRENT_TIMESTAMP
      WHERE id = ${gameId}
    `;

    // Update game players
    await db`
      UPDATE game_players 
      SET 
        game_status = 'completed',
        is_winner = CASE 
          WHEN EXISTS (
            SELECT 1 FROM players p 
            WHERE p.id = game_players.player_id 
            AND p.wallet_address = ${winnerWallet}
          ) THEN true
          ELSE false
        END
      WHERE game_id = ${gameId}
    `;

    // Calculate winnings (96% goes to winner, 4% platform fee)
    const totalPot = parseFloat(game.entry_fee) * 2;
    const platformFee = totalPot * 0.04;
    const winnerAmount = totalPot - platformFee;

    console.log(`💰 Game completion: Total pot: ${totalPot} SOL, Winner gets: ${winnerAmount} SOL, Platform fee: ${platformFee} SOL`);

    // Send SMS notifications
    try {
      for (const player of playersResult) {
        if (player.phone_number && player.sms_notifications_enabled) {
          const isWinner = player.wallet_address === winnerWallet;
          await smsService.sendGameCompleted(
            player.phone_number,
            game.game_type,
            isWinner,
            isWinner ? winnerAmount : undefined
          );
          console.log(`📱 Game completion SMS sent to ${player.username} (${isWinner ? 'winner' : 'loser'})`);
        }
      }
    } catch (smsError) {
      console.error('Failed to send SMS notifications:', smsError);
      // Don't fail the completion if SMS fails
    }

    // Create game stats for both players
    const winnerPlayer = playersResult.find(p => p.wallet_address === winnerWallet);
    const loserPlayer = playersResult.find(p => p.wallet_address === loserWallet);

    if (winnerPlayer && loserPlayer) {
      try {
        // Winner stats
        await db`
          INSERT INTO game_stats (game_id, player_id, game_type, result, amount, opponent_id)
          VALUES (${gameId}, ${winnerPlayer.player_id}, ${game.game_type}, 'win', ${winnerAmount}, ${loserPlayer.player_id})
        `;

        // Loser stats
        await db`
          INSERT INTO game_stats (game_id, player_id, game_type, result, amount, opponent_id)
          VALUES (${gameId}, ${loserPlayer.player_id}, ${game.game_type}, 'loss', ${-parseFloat(game.entry_fee)}, ${winnerPlayer.player_id})
        `;

        // Update player stats
        await db`
          INSERT INTO player_stats (player_id, games_played, games_won, total_winnings)
          VALUES (${winnerPlayer.player_id}, 1, 1, ${winnerAmount})
          ON CONFLICT (player_id) DO UPDATE SET
            games_played = player_stats.games_played + 1,
            games_won = player_stats.games_won + 1,
            total_winnings = player_stats.total_winnings + ${winnerAmount}
        `;

        await db`
          INSERT INTO player_stats (player_id, games_played, games_won, total_winnings)
          VALUES (${loserPlayer.player_id}, 1, 0, ${-parseFloat(game.entry_fee)})
          ON CONFLICT (player_id) DO UPDATE SET
            games_played = player_stats.games_played + 1,
            total_winnings = player_stats.total_winnings + ${-parseFloat(game.entry_fee)}
        `;

        console.log(`📊 Stats updated for both players`);
      } catch (statsError) {
        console.error('Failed to update game stats:', statsError);
        // Continue even if stats update fails
      }
    }

    return NextResponse.json({ 
      success: true,
      winner: winnerWallet,
      loser: loserWallet,
      winnerAmount: winnerAmount,
      platformFee: platformFee,
      gameId: gameId
    });

  } catch (error) {
    console.error('Error completing game:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 