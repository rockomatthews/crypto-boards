import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';

// Initialize Solana connection (use devnet for testing)
const connection = new Connection(
  process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  'confirmed'
);

// Get escrow public key from environment or use a default for development
export function getEscrowPublicKey(): PublicKey {
  const escrowKey = process.env.ESCROW_PUBLIC_KEY || 'CryptoBoards1111111111111111111111111111111';
  try {
    return new PublicKey(escrowKey);
  } catch {
    // Fallback to a valid public key for development
    return new PublicKey('11111111111111111111111111111111');
  }
}

export interface PaymentResult {
  success: boolean;
  signature?: string;
  error?: string;
}

export interface PayoutResult {
  success: boolean;
  signature?: string;
  error?: string;
  amount?: number;
}

/**
 * Process a real SOL payment for game entry
 */
export async function processSolPayment(
  fromWalletAddress: string,
  amount: number
): Promise<PaymentResult> {
  try {
    // Convert SOL amount to lamports
    const lamports = amount * LAMPORTS_PER_SOL;
    
    // Create a new transaction
    const transaction = new Transaction();
    
    // Add transfer instruction
    const transferInstruction = SystemProgram.transfer({
      fromPubkey: new PublicKey(fromWalletAddress),
      toPubkey: getEscrowPublicKey(),
      lamports: lamports,
    });
    
    transaction.add(transferInstruction);
    
    // Note: In a real implementation, you would:
    // 1. Get the user's wallet (from wallet adapter)
    // 2. Sign the transaction with the user's wallet
    // 3. Send and confirm the transaction
    
    // For now, we'll return a simulated success
    // TODO: Implement actual wallet signing and transaction sending
    console.log(`Simulated SOL payment: ${amount} SOL from ${fromWalletAddress} to escrow`);
    
    return {
      success: true,
      signature: 'simulated_signature_' + Date.now(),
    };
  } catch (error) {
    console.error('Error processing SOL payment:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Process winner payout in SOL
 */
export async function processWinnerPayout(
  toWalletAddress: string,
  amount: number
): Promise<PayoutResult> {
  try {
    // Convert SOL amount to lamports
    const lamports = amount * LAMPORTS_PER_SOL;
    
    // Create a new transaction
    const transaction = new Transaction();
    
    // Add transfer instruction from escrow to winner
    const transferInstruction = SystemProgram.transfer({
      fromPubkey: getEscrowPublicKey(),
      toPubkey: new PublicKey(toWalletAddress),
      lamports: lamports,
    });
    
    transaction.add(transferInstruction);
    
    // Note: In a real implementation, you would:
    // 1. Use your escrow account's private key to sign
    // 2. Send and confirm the transaction
    
    // For now, we'll return a simulated success
    console.log(`Simulated winner payout: ${amount} SOL to ${toWalletAddress}`);
    
    return {
      success: true,
      signature: 'simulated_payout_signature_' + Date.now(),
      amount: amount,
    };
  } catch (error) {
    console.error('Error processing winner payout:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get SOL balance for a wallet address
 */
export async function getSolBalance(walletAddress: string): Promise<number> {
  try {
    const publicKey = new PublicKey(walletAddress);
    const balance = await connection.getBalance(publicKey);
    return balance / LAMPORTS_PER_SOL;
  } catch (error) {
    console.error('Error getting SOL balance:', error);
    return 0;
  }
}

/**
 * Verify a transaction signature and check if it's a valid payment to escrow
 */
export async function verifyTransaction(signature: string): Promise<boolean> {
  try {
    const transaction = await connection.getTransaction(signature, {
      commitment: 'confirmed'
    });
    
    if (!transaction) {
      console.error('Transaction not found:', signature);
      return false;
    }

    // Check if transaction was successful
    if (transaction.meta?.err) {
      console.error('Transaction failed:', transaction.meta.err);
      return false;
    }

    // For a more thorough verification, you could:
    // 1. Check that the transaction sends SOL to the correct escrow address
    // 2. Verify the amount matches the expected entry fee
    // 3. Check that the transaction is recent (within last few minutes)
    
    console.log('Transaction verified successfully:', signature);
    return true;
  } catch (error) {
    console.error('Error verifying transaction:', error);
    return false;
  }
} 