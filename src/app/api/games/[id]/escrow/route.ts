/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/schema';
import { PublicKey } from '@solana/web3.js';
import { 
  calculatePlatformFee,
  createGameEscrow,
  processWinnerPayout,
  processRefund
} from '@/lib/solana';

// Check if escrow tables exist
async function ensureEscrowTablesExist() {
  try {
    // Try to create the tables if they don't exist
    await db`
      CREATE TABLE IF NOT EXISTS game_escrows (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        game_id UUID NOT NULL,
        player_id UUID NOT NULL,
        escrow_account TEXT NOT NULL,
        amount DECIMAL(18, 9) NOT NULL,
        status VARCHAR(20) DEFAULT 'active',
        transaction_signature TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        released_at TIMESTAMP
      )
    `;

    await db`
      CREATE TABLE IF NOT EXISTS platform_fees (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        game_id UUID NOT NULL,
        amount DECIMAL(18, 9) NOT NULL,
        transaction_signature TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    return true;
  } catch (error) {
    console.error('Error ensuring escrow tables exist:', error);
    return false;
  }
}

export async function POST(
  request: NextRequest,
  context: any
) {
  try {
    const gameId = context?.params?.id;
    const requestBody = await request.json();
    const { action, playerWallet, amount, transactionData, winnerId } = requestBody;

    if (!gameId || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // For get_escrow_status, we don't need playerWallet
    if (action !== 'get_escrow_status' && !playerWallet) {
      return NextResponse.json({ error: 'Missing playerWallet' }, { status: 400 });
    }

    // Ensure escrow tables exist
    const tablesExist = await ensureEscrowTablesExist();
    if (!tablesExist) {
      console.error('Failed to ensure escrow tables exist');
      return NextResponse.json({ error: 'Database not ready' }, { status: 503 });
    }

    switch (action) {
      case 'get_escrow_status': {
        // Get escrow status for the game
        const escrows = await db`
          SELECT ge.*, p.username, p.wallet_address
          FROM game_escrows ge
          JOIN players p ON ge.player_id = p.id
          WHERE ge.game_id = ${gameId}
          ORDER BY ge.created_at ASC
        `;

        const totalEscrowed = escrows
          .filter(e => e.status === 'active')
          .reduce((sum, escrow) => sum + parseFloat(escrow.amount), 0);

        const platformFee = calculatePlatformFee(totalEscrowed);

        return NextResponse.json({
          escrows,
          totalEscrowed,
          platformFeePercentage: 0.04, // 4%
          estimatedPlatformFee: platformFee,
          estimatedWinnerAmount: totalEscrowed - platformFee
        });
      }

      case 'create_escrow': {
        if (!amount || !transactionData || !playerWallet) {
          return NextResponse.json({ error: 'Amount, transaction data, and playerWallet required for escrow creation' }, { status: 400 });
        }

        const playerKey = new PublicKey(playerWallet);

        // Get player ID
        const playerResult = await db`
          SELECT id FROM players WHERE wallet_address = ${playerWallet}
        `;

        if (playerResult.length === 0) {
          return NextResponse.json({ error: 'Player not found' }, { status: 404 });
        }

        const playerId = playerResult[0].id;

        // Check if escrow already exists for this player in this game
        const existingEscrow = await db`
          SELECT id FROM game_escrows 
          WHERE game_id = ${gameId} AND player_id = ${playerId} AND status = 'active'
        `;

        if (existingEscrow.length > 0) {
          return NextResponse.json({ error: 'Escrow already exists for this player' }, { status: 400 });
        }

        try {
          // Create the game escrow
          const { escrowAccount, transactionSignature } = await createGameEscrow(
            playerKey,
            amount,
            gameId
          );

          // Record escrow in database
          await db`
            INSERT INTO game_escrows (game_id, player_id, escrow_account, amount, status, transaction_signature)
            VALUES (${gameId}, ${playerId}, ${escrowAccount.publicKey.toString()}, ${amount}, 'active', ${transactionSignature})
          `;

          return NextResponse.json({
            success: true,
            escrowAccount: escrowAccount.publicKey.toString(),
            amount,
            transactionSignature,
            message: 'Escrow created successfully'
          });

        } catch (escrowError) {
          console.error('Error creating escrow:', escrowError);
          return NextResponse.json({ error: 'Failed to create escrow' }, { status: 500 });
        }
      }

      case 'release_escrow': {
        if (!winnerId || !playerWallet) {
          return NextResponse.json({ error: 'Winner ID and playerWallet required' }, { status: 400 });
        }

        console.log(`💰 Releasing escrow for game ${gameId}, winner: ${winnerId}`);

        // Get all active escrows for this game
        const escrows = await db`
          SELECT ge.*, p.wallet_address
          FROM game_escrows ge
          JOIN players p ON ge.player_id = p.id
          WHERE ge.game_id = ${gameId} AND ge.status = 'active'
        `;

        console.log(`Found ${escrows.length} active escrows`);

        if (escrows.length === 0) {
          console.log('⚠️ No active escrows found, checking for any escrows...');
          
          // Check if any escrows exist at all
          const allEscrows = await db`
            SELECT ge.*, p.wallet_address
            FROM game_escrows ge
            JOIN players p ON ge.player_id = p.id
            WHERE ge.game_id = ${gameId}
          `;
          
          if (allEscrows.length === 0) {
            console.log('⚠️ No escrows found for this game at all');
            // This is fine - game might not have required escrows
            return NextResponse.json({ 
              success: true,
              message: 'No escrows to release - game completed without escrow funds',
              winnerAmount: 0,
              platformFee: 0,
              totalAmount: 0
            });
          } else {
            console.log(`⚠️ Found ${allEscrows.length} escrows but none are active:`, allEscrows.map(e => ({ status: e.status, amount: e.amount })));
            return NextResponse.json({ 
              success: true,
              message: 'Escrows already processed',
              winnerAmount: 0,
              platformFee: 0,
              totalAmount: 0
            });
          }
        }

        // Calculate total amount
        const totalAmount = escrows.reduce((sum, escrow) => sum + parseFloat(escrow.amount), 0);
        const platformFee = calculatePlatformFee(totalAmount);
        const winnerAmount = totalAmount - platformFee;

        console.log(`💰 Escrow totals: ${totalAmount} SOL total, ${platformFee} SOL fee, ${winnerAmount} SOL to winner`);

        // Get winner wallet address
        const winnerResult = await db`
          SELECT wallet_address FROM players WHERE id = ${winnerId}
        `;

        if (winnerResult.length === 0) {
          return NextResponse.json({ error: 'Winner not found' }, { status: 404 });
        }

        const winnerWallet = winnerResult[0].wallet_address;
        console.log(`🏆 Winner wallet: ${winnerWallet}`);

        try {
          // Process the winner payout
          const payoutResult = await processWinnerPayout(winnerWallet, totalAmount, gameId);

          if (!payoutResult.success) {
            console.error('❌ Payout failed:', payoutResult.error);
            throw new Error(payoutResult.error || 'Payout failed');
          }

          console.log(`✅ Payout successful: ${payoutResult.signature}`);

          // Update escrows as released
          await db`
            UPDATE game_escrows 
            SET status = 'released', released_at = CURRENT_TIMESTAMP
            WHERE game_id = ${gameId} AND status = 'active'
          `;

          // Record platform fee
          await db`
            INSERT INTO platform_fees (game_id, amount, transaction_signature)
            VALUES (${gameId}, ${platformFee}, ${payoutResult.signature})
          `;

          // Update game payout record (try-catch in case table doesn't exist)
          try {
            await db`
              INSERT INTO game_payouts (game_id, winner_wallet, amount, transaction_signature)
              VALUES (${gameId}, ${winnerWallet}, ${winnerAmount}, ${payoutResult.signature})
            `;
          } catch (payoutRecordError) {
            console.warn('⚠️ Failed to record payout (table may not exist):', payoutRecordError);
            // Continue - this is not critical
          }

          return NextResponse.json({
            success: true,
            winnerAmount,
            platformFee,
            totalAmount,
            transactionSignature: payoutResult.signature,
            message: 'Escrow released successfully'
          });

        } catch (releaseError) {
          console.error('❌ Error releasing escrow:', releaseError);
          return NextResponse.json({ 
            error: 'Failed to release escrow',
            details: releaseError instanceof Error ? releaseError.message : 'Unknown error'
          }, { status: 500 });
        }
      }

      case 'refund_escrow': {
        if (!playerWallet) {
          return NextResponse.json({ error: 'playerWallet required' }, { status: 400 });
        }

        // Get player ID
        const playerResult = await db`
          SELECT id FROM players WHERE wallet_address = ${playerWallet}
        `;

        if (playerResult.length === 0) {
          return NextResponse.json({ error: 'Player not found' }, { status: 404 });
        }

        const playerId = playerResult[0].id;

        // Get active escrow for this player
        const escrowResult = await db`
          SELECT * FROM game_escrows 
          WHERE game_id = ${gameId} AND player_id = ${playerId} AND status = 'active'
        `;

        if (escrowResult.length === 0) {
          return NextResponse.json({ error: 'No active escrow found for this player' }, { status: 404 });
        }

        const escrow = escrowResult[0];

        try {
          // Process the refund
          const refundResult = await processRefund(playerWallet, parseFloat(escrow.amount));

          if (!refundResult.success) {
            throw new Error(refundResult.error || 'Refund failed');
          }

          // Update escrow as refunded
          await db`
            UPDATE game_escrows 
            SET status = 'refunded', released_at = CURRENT_TIMESTAMP
            WHERE id = ${escrow.id}
          `;

          // Record refund
          await db`
            INSERT INTO game_refunds (game_id, player_wallet, amount, transaction_signature)
            VALUES (${gameId}, ${playerWallet}, ${escrow.amount}, ${refundResult.signature})
          `;

          return NextResponse.json({
            success: true,
            refundAmount: parseFloat(escrow.amount),
            transactionSignature: refundResult.signature,
            message: 'Escrow refunded successfully'
          });

        } catch (refundError) {
          console.error('Error refunding escrow:', refundError);
          return NextResponse.json({ error: 'Failed to refund escrow' }, { status: 500 });
        }
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Error in escrow API:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}