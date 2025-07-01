/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/schema';
import smsService from '@/lib/sms';

export async function POST(
  request: NextRequest,
  context: any
) {
  try {
    const { winnerWallet, loserWallet } = await request.json();
    const gameId = context?.params?.id;

    console.log(`🏁 Starting game completion for ${gameId}...`);
    console.log(`📝 Request data:`, { winnerWallet: winnerWallet?.slice(0, 8), loserWallet: loserWallet?.slice(0, 8) });

    if (!gameId) {
      return NextResponse.json({ error: 'Game ID is required' }, { status: 400 });
    }

    if (!winnerWallet || !loserWallet) {
      console.error('❌ Missing winner or loser wallet addresses');
      return NextResponse.json({ 
        error: 'Winner and loser wallet addresses are required',
        details: { winnerWallet: !!winnerWallet, loserWallet: !!loserWallet }
      }, { status: 400 });
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
      console.error(`❌ Game ${gameId} not found`);
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    const game = gameResult[0];

    if (game.status === 'completed') {
      console.log(`⚠️ Game ${gameId} already completed`);
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

    // 🚀 AUTOMATICALLY RELEASE ESCROW FUNDS TO WINNER
    let escrowReleaseResult = null;
    try {
      console.log(`💰 Automatically releasing escrow for winner: ${winnerWallet.slice(0, 8)}...`);
      
      const escrowResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/games/${gameId}/escrow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'release_escrow',
          winnerId: winnerPlayer?.player_id,
          playerWallet: winnerWallet
        })
      });

      if (escrowResponse.ok) {
        escrowReleaseResult = await escrowResponse.json();
        console.log(`✅ Escrow released successfully:`, {
          winnerAmount: escrowReleaseResult.winnerAmount,
          platformFee: escrowReleaseResult.platformFee,
          totalAmount: escrowReleaseResult.totalAmount,
          transactionSignature: escrowReleaseResult.transactionSignature
        });
      } else {
        const escrowError = await escrowResponse.text();
        console.warn(`⚠️ Escrow release failed (${escrowResponse.status}):`, escrowError);
        // Don't fail the game completion if escrow release fails
      }
    } catch (escrowError) {
      console.warn('⚠️ Failed to release escrow automatically:', escrowError);
      // Don't fail the game completion if escrow release fails
    }

    return NextResponse.json({ 
      success: true,
      winner: winnerWallet,
      loser: loserWallet,
      winnerAmount: escrowReleaseResult?.winnerAmount || winnerAmount,
      platformFee: escrowReleaseResult?.platformFee || platformFee,
      gameId: gameId,
      escrowReleased: !!escrowReleaseResult,
      escrowTransactionSignature: escrowReleaseResult?.transactionSignature,
      message: escrowReleaseResult 
        ? `Game completed! Winner payout of ${escrowReleaseResult.winnerAmount} SOL processed successfully.`
        : `Game completed! Winner recorded, but escrow payout may need manual processing.`
    });

  } catch (error) {
    console.error('Error completing game:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 