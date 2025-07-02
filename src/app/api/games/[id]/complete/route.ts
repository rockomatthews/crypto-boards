/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/schema';
import smsService from '@/lib/sms';
import { 
  Connection, 
  PublicKey, 
  LAMPORTS_PER_SOL,
  Keypair,
  Transaction,
  SystemProgram
} from '@solana/web3.js';

// Direct SOL transfer function
async function sendSOLDirectly(
  fromPrivateKey: string,
  toWallet: string,
  amount: number,
  gameId: string
): Promise<{ success: boolean; signature?: string; error?: string }> {
  try {
    console.log(`💰 DIRECT SOL TRANSFER: ${amount} SOL to ${toWallet} for game ${gameId}`);

    // Get connection
    const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    const connection = new Connection(RPC_URL, 'confirmed');

    // Parse private key
    let privateKeyBytes: Uint8Array;
    
    if (fromPrivateKey.includes('[') && fromPrivateKey.includes(']')) {
      const keyArray = JSON.parse(fromPrivateKey);
      privateKeyBytes = new Uint8Array(keyArray);
    } else if (fromPrivateKey.length === 128) {
      privateKeyBytes = new Uint8Array(Buffer.from(fromPrivateKey, 'hex'));
    } else {
      try {
        privateKeyBytes = new Uint8Array(Buffer.from(fromPrivateKey, 'base64'));
      } catch {
        const bs58 = await import('bs58');
        privateKeyBytes = bs58.default.decode(fromPrivateKey);
      }
    }
    
    const platformKeypair = Keypair.fromSecretKey(privateKeyBytes);
    const winnerWallet = new PublicKey(toWallet);
    
    console.log(`💳 Platform wallet: ${platformKeypair.publicKey.toString()}`);
    console.log(`🏆 Winner wallet: ${winnerWallet.toString()}`);

    // Check balance
    const balance = await connection.getBalance(platformKeypair.publicKey);
    const requiredLamports = Math.floor(amount * LAMPORTS_PER_SOL);
    
    console.log(`💰 Platform balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    console.log(`💰 Sending: ${amount} SOL (${requiredLamports} lamports)`);
    
    if (balance < requiredLamports) {
      throw new Error(`Insufficient balance: ${balance / LAMPORTS_PER_SOL} SOL < ${amount} SOL required`);
    }

    // Create transaction
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: platformKeypair.publicKey,
        toPubkey: winnerWallet,
        lamports: requiredLamports,
      })
    );

    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = platformKeypair.publicKey;

    // Send transaction
    const signature = await connection.sendTransaction(transaction, [platformKeypair], {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
      maxRetries: 3
    });

    console.log(`⏳ Transaction sent: ${signature}`);

    // Confirm transaction
    const confirmation = await connection.confirmTransaction(signature, 'confirmed');
    
    if (confirmation.value?.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
    }
    
    console.log(`✅ REAL SOL TRANSFER CONFIRMED: ${amount} SOL to ${toWallet}`);
    console.log(`🔗 Signature: ${signature}`);
    
    return { success: true, signature };

  } catch (error) {
    console.error('❌ Direct SOL transfer failed:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

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
    
    // Calculate winnings (96% goes to winner, 4% platform fee)
    const totalPot = parseFloat(game.entry_fee) * 2;
    const platformFee = totalPot * 0.04;
    const winnerAmount = totalPot - platformFee;

    if (game.status === 'completed') {
      console.log(`⚠️ Game ${gameId} already completed - attempting direct payout...`);
      
      // Game already completed - try direct SOL transfer
      const privateKey = process.env.PLATFORM_WALLET_PRIVATE_KEY;
      if (privateKey) {
        const directTransfer = await sendSOLDirectly(privateKey, winnerWallet, winnerAmount, gameId);
        
        if (directTransfer.success) {
          console.log(`✅ Direct SOL transfer successful for completed game!`);
          
          return NextResponse.json({ 
            success: true,
            alreadyCompleted: true,
            winner: winnerWallet,
            loser: loserWallet,
            winnerAmount: winnerAmount,
            platformFee: platformFee,
            gameId: gameId,
            escrowReleased: true,
            escrowTransactionSignature: directTransfer.signature,
            message: `Game was already completed - payout of ${winnerAmount} SOL sent directly!`
          });
        } else {
          console.error(`❌ Direct SOL transfer failed:`, directTransfer.error);
        }
      }
      
      // Fall back to "already completed" response
      return NextResponse.json({ 
        success: true,
        alreadyCompleted: true,
        message: 'Game was already completed',
        gameId: gameId,
        escrowReleased: false
      });
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

    // 🚀 DIRECT SOL TRANSFER TO WINNER (BYPASS COMPLEX ESCROW APIS)
    let payoutResult = null;
    const privateKey = process.env.PLATFORM_WALLET_PRIVATE_KEY;
    
    if (privateKey) {
      console.log(`💰 Sending ${winnerAmount} SOL directly to winner...`);
      payoutResult = await sendSOLDirectly(privateKey, winnerWallet, winnerAmount, gameId);
      
      if (payoutResult.success) {
        console.log(`✅ DIRECT SOL PAYOUT SUCCESSFUL!`);
        console.log(`🔗 Transaction: ${payoutResult.signature}`);
      } else {
        console.error(`❌ Direct SOL payout failed:`, payoutResult.error);
      }
    } else {
      console.warn(`⚠️ No PLATFORM_WALLET_PRIVATE_KEY - cannot send real SOL`);
    }

    return NextResponse.json({ 
      success: true,
      winner: winnerWallet,
      loser: loserWallet,
      winnerAmount: winnerAmount,
      platformFee: platformFee,
      gameId: gameId,
      escrowReleased: !!payoutResult?.success,
      escrowTransactionSignature: payoutResult?.signature,
      message: payoutResult?.success 
        ? `Game completed! Winner received ${winnerAmount} SOL directly!`
        : `Game completed! Winner recorded but payout failed: ${payoutResult?.error || 'No private key configured'}`
    });

  } catch (error) {
    console.error('Error completing game:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 