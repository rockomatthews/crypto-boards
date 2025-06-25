/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/schema';
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';

const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com');

export async function POST(
  request: NextRequest,
  context: any
) {
  try {
    const gameId = context?.params?.id;
    const { winnerId, gameType } = await request.json();

    if (!winnerId || !gameType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get game details
    const gameResult = await db`
      SELECT 
        g.id,
        g.game_type,
        g.status,
        g.entry_fee,
        g.created_at
      FROM games g
      WHERE g.id = ${gameId} AND g.status = 'in_progress'
    `;

    if (gameResult.length === 0) {
      return NextResponse.json({ error: 'Game not found or already completed' }, { status: 404 });
    }

    const game = gameResult[0];

    // Get all players in the game
    const playersResult = await db`
      SELECT 
        p.id,
        p.username,
        p.wallet_address,
        gp.game_status
      FROM game_players gp
      JOIN players p ON gp.player_id = p.id
      WHERE gp.game_id = ${gameId} AND gp.game_status = 'active'
      ORDER BY gp.joined_at ASC
    `;

    if (playersResult.length !== 2) {
      return NextResponse.json({ error: 'Game must have exactly 2 active players' }, { status: 400 });
    }

    const winner = playersResult.find(p => p.id === winnerId);
    const loser = playersResult.find(p => p.id !== winnerId);

    if (!winner || !loser) {
      return NextResponse.json({ error: 'Invalid winner ID' }, { status: 400 });
    }

    // Calculate payout amount (total entry fees minus platform fee if any)
    const totalPot = game.entry_fee * 2;
    const winnerPayout = totalPot; // For now, winner takes all

    try {
      // Create transaction to pay winner
      const transaction = new Transaction();
      const platformWallet = new PublicKey(process.env.PLATFORM_WALLET_ADDRESS!);
      const winnerWallet = new PublicKey(winner.wallet_address);

      transaction.add(
        SystemProgram.transfer({
          fromPubkey: platformWallet,
          toPubkey: winnerWallet,
          lamports: Math.floor(winnerPayout * LAMPORTS_PER_SOL),
        })
      );

      // Get recent blockhash
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = platformWallet;

      // For demo purposes, we'll simulate the transaction
      // In production, you'd sign this with the platform wallet private key
      const simulatedSignature = `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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

      // Record payout
      await db`
        INSERT INTO game_payouts (game_id, winner_wallet, amount, transaction_signature)
        VALUES (${gameId}, ${winner.wallet_address}, ${winnerPayout}, ${simulatedSignature})
      `;

      // Record game stats for both players
      await db`
        INSERT INTO game_stats (game_id, player_id, game_type, result, amount, opponent_id)
        VALUES 
          (${gameId}, ${winnerId}, ${gameType}, 'win', ${winnerPayout}, ${loser.id}),
          (${gameId}, ${loser.id}, ${gameType}, 'loss', ${game.entry_fee}, ${winnerId})
      `;

      // Update aggregated player stats for winner
      await db`
        INSERT INTO player_stats (player_id, games_played, games_won, total_winnings, current_streak, best_streak, updated_at)
        VALUES (${winnerId}, 1, 1, ${winnerPayout}, 1, 1, CURRENT_TIMESTAMP)
        ON CONFLICT (player_id) DO UPDATE SET
          games_played = player_stats.games_played + 1,
          games_won = player_stats.games_won + 1,
          total_winnings = player_stats.total_winnings + ${winnerPayout},
          current_streak = CASE 
            WHEN player_stats.current_streak >= 0 THEN player_stats.current_streak + 1
            ELSE 1
          END,
          best_streak = GREATEST(player_stats.best_streak, 
            CASE 
              WHEN player_stats.current_streak >= 0 THEN player_stats.current_streak + 1
              ELSE 1
            END
          ),
          updated_at = CURRENT_TIMESTAMP
      `;

      // Update aggregated player stats for loser
      await db`
        INSERT INTO player_stats (player_id, games_played, games_won, total_losses, current_streak, best_streak, updated_at)
        VALUES (${loser.id}, 1, 0, ${game.entry_fee}, -1, 0, CURRENT_TIMESTAMP)
        ON CONFLICT (player_id) DO UPDATE SET
          games_played = player_stats.games_played + 1,
          total_losses = player_stats.total_losses + ${game.entry_fee},
          current_streak = CASE 
            WHEN player_stats.current_streak <= 0 THEN player_stats.current_streak - 1
            ELSE -1
          END,
          updated_at = CURRENT_TIMESTAMP
      `;

      return NextResponse.json({ 
        success: true,
        message: 'Game completed successfully',
        winner: winner.username,
        payout: winnerPayout,
        transactionSignature: simulatedSignature
      });

    } catch (error) {
      console.error('Error processing payout:', error);
      return NextResponse.json({ error: 'Failed to process payout' }, { status: 500 });
    }

  } catch (error) {
    console.error('Error completing game:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 