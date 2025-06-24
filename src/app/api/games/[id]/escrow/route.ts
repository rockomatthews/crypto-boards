/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/schema';
import { PublicKey } from '@solana/web3.js';
import { 
  checkWalletBalance,
  PLATFORM_FEE_PERCENTAGE
} from '@/lib/solana';

export async function POST(
  request: NextRequest,
  context: any
) {
  try {
    const gameId = context?.params?.id;
    const { action, playerWallet, amount, transactionData } = await request.json();

    if (!gameId || !action || !playerWallet) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const playerKey = new PublicKey(playerWallet);

    switch (action) {
      case 'create_escrow': {
        if (!amount || !transactionData) {
          return NextResponse.json({ error: 'Amount and transaction data required for escrow creation' }, { status: 400 });
        }

        // Check if player has sufficient balance
        const hasBalance = await checkWalletBalance(playerKey, amount + 0.01); // Add buffer for fees
        if (!hasBalance) {
          return NextResponse.json({ error: 'Insufficient wallet balance' }, { status: 400 });
        }

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
          // Note: In a real implementation, you'd call createGameEscrow here
          // For now, we'll simulate the escrow creation
          const escrowAccount = `escrow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const transactionSignature = transactionData.signature || `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

          // Record escrow in database
          await db`
            INSERT INTO game_escrows (game_id, player_id, escrow_account, amount, status, transaction_signature)
            VALUES (${gameId}, ${playerId}, ${escrowAccount}, ${amount}, 'active', ${transactionSignature})
          `;

          return NextResponse.json({
            success: true,
            escrowAccount,
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
        const { winnerId } = await request.json();
        
        if (!winnerId) {
          return NextResponse.json({ error: 'Winner ID required' }, { status: 400 });
        }

        // Get all active escrows for this game
        const escrows = await db`
          SELECT ge.*, p.wallet_address
          FROM game_escrows ge
          JOIN players p ON ge.player_id = p.id
          WHERE ge.game_id = ${gameId} AND ge.status = 'active'
        `;

        if (escrows.length === 0) {
          return NextResponse.json({ error: 'No active escrows found' }, { status: 404 });
        }

        // Calculate total amount
        const totalAmount = escrows.reduce((sum, escrow) => sum + parseFloat(escrow.amount), 0);
        const platformFee = totalAmount * PLATFORM_FEE_PERCENTAGE;
        const winnerAmount = totalAmount - platformFee;

        // Get winner wallet address
        const winnerResult = await db`
          SELECT wallet_address FROM players WHERE id = ${winnerId}
        `;

        if (winnerResult.length === 0) {
          return NextResponse.json({ error: 'Winner not found' }, { status: 404 });
        }

        const winnerWallet = winnerResult[0].wallet_address;

        try {
          // Note: In a real implementation, you'd call releaseEscrowToWinner here
          const releaseSignature = `release_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

          // Update escrows as released
          await db`
            UPDATE game_escrows 
            SET status = 'released', released_at = CURRENT_TIMESTAMP
            WHERE game_id = ${gameId} AND status = 'active'
          `;

          // Record platform fee
          await db`
            INSERT INTO platform_fees (game_id, amount, transaction_signature)
            VALUES (${gameId}, ${platformFee}, ${releaseSignature})
          `;

          // Update game payout record
          await db`
            INSERT INTO game_payouts (game_id, winner_wallet, amount, transaction_signature)
            VALUES (${gameId}, ${winnerWallet}, ${winnerAmount}, ${releaseSignature})
          `;

          return NextResponse.json({
            success: true,
            winnerAmount,
            platformFee,
            totalAmount,
            transactionSignature: releaseSignature,
            message: 'Escrow released successfully'
          });

        } catch (releaseError) {
          console.error('Error releasing escrow:', releaseError);
          return NextResponse.json({ error: 'Failed to release escrow' }, { status: 500 });
        }
      }

      case 'refund_escrow': {
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
          // Note: In a real implementation, you'd call refundEscrowToPlayer here
          const refundSignature = `refund_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

          // Update escrow as refunded
          await db`
            UPDATE game_escrows 
            SET status = 'refunded', released_at = CURRENT_TIMESTAMP
            WHERE id = ${escrow.id}
          `;

          // Record refund
          await db`
            INSERT INTO game_refunds (game_id, player_wallet, amount, transaction_signature)
            VALUES (${gameId}, ${playerWallet}, ${escrow.amount}, ${refundSignature})
          `;

          return NextResponse.json({
            success: true,
            refundAmount: parseFloat(escrow.amount),
            transactionSignature: refundSignature,
            message: 'Escrow refunded successfully'
          });

        } catch (refundError) {
          console.error('Error refunding escrow:', refundError);
          return NextResponse.json({ error: 'Failed to refund escrow' }, { status: 500 });
        }
      }

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

        return NextResponse.json({
          escrows,
          totalEscrowed,
          platformFeePercentage: PLATFORM_FEE_PERCENTAGE,
          estimatedPlatformFee: totalEscrowed * PLATFORM_FEE_PERCENTAGE,
          estimatedWinnerAmount: totalEscrowed * (1 - PLATFORM_FEE_PERCENTAGE)
        });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Error in escrow API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}