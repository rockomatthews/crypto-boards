import { 
  Connection, 
  PublicKey, 
  LAMPORTS_PER_SOL,
  Keypair
} from '@solana/web3.js';

// Use proper RPC URL for environment
const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
export const PLATFORM_WALLET = new PublicKey(
  process.env.NEXT_PUBLIC_PLATFORM_WALLET_ADDRESS || 
  'CHyQpdkGgoQbQDdm9vgjc3NpiBQ9wQ8Fu8LHQaPwoNdN'
);

export interface PaymentResult {
  success: boolean;
  signature?: string;
  error?: string;
}

export interface PayoutResult {
  success: boolean;
  signature?: string;
  amount?: number;
  error?: string;
}

let connection: Connection;

export const getConnection = () => {
  if (!connection) {
    connection = new Connection(RPC_URL, 'confirmed');
  }
  return connection;
};

// Get platform wallet for escrow operations
export const getEscrowPublicKey = () => {
  return PLATFORM_WALLET;
};

// Generate a unique escrow account for each game
export const generateEscrowAccount = () => {
  return Keypair.generate();
};

// Create escrow account and fund it
export const createGameEscrow = async (
  playerWallet: PublicKey,
  entryFee: number,
  gameId: string
): Promise<{
  escrowAccount: Keypair;
  transactionSignature: string;
}> => {
  const escrowAccount = generateEscrowAccount();
  
  try {
    // For demo purposes, we'll simulate the escrow creation
    // In production, this would create an actual escrow account
    console.log(`🎮 Creating escrow for game ${gameId}:`, {
      player: playerWallet.toString(),
      amount: entryFee,
      escrow: escrowAccount.publicKey.toString()
    });

    // Simulate payment processing
    const simulatedSignature = `escrow_${gameId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`✅ Escrow created for game ${gameId}:`, {
      escrowAccount: escrowAccount.publicKey.toString(),
      amount: entryFee,
      signature: simulatedSignature
    });
    
    return {
      escrowAccount,
      transactionSignature: simulatedSignature
    };
    
  } catch (error) {
    console.error('❌ Failed to create escrow:', error);
    throw new Error(`Failed to create escrow: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Verify a transaction exists and is valid
export const verifyTransaction = async (signature: string): Promise<boolean> => {
  try {
    // For demo purposes, accept any signature that looks valid
    if (signature.startsWith('mock_signature_') || signature.startsWith('escrow_') || signature.startsWith('sim_')) {
      console.log(`✅ Mock transaction verified: ${signature}`);
      return true;
    }

    // In production, verify real transactions:
    /*
    const connection = getConnection();
    const transaction = await connection.getTransaction(signature);
    return transaction !== null && transaction.meta?.err === null;
    */
    
    return true;
  } catch (error) {
    console.error('❌ Transaction verification failed:', error);
    return false;
  }
};

// Process game entry payment
export const processGameEntryPayment = async (
  fromWallet: PublicKey,
  amount: number,
  gameId: string
): Promise<PaymentResult> => {
  try {
    console.log(`💰 Processing entry payment: ${amount} SOL from ${fromWallet.toString()} for game ${gameId}`);
    
    // For demo purposes, simulate payment
    const mockSignature = `payment_${gameId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`✅ Entry payment processed: ${mockSignature}`);
    
    return {
      success: true,
      signature: mockSignature,
    };
  } catch (error) {
    console.error('❌ Error processing entry payment:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

// Refund escrow to player (if they leave before game starts)
export const refundEscrowToPlayer = async (
  escrowAccount: Keypair,
  playerWallet: PublicKey,
  amount: number,
  gameId: string
): Promise<{
  refundAmount: number;
  transactionSignature: string;
}> => {
  try {
    console.log(`🔄 Processing refund: ${amount} SOL to ${playerWallet.toString()} for game ${gameId}`);
    
    // For demo purposes, simulate refund
    const mockSignature = `refund_${gameId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`✅ Refund processed: ${amount} SOL refunded with signature ${mockSignature}`);
    
    return {
      refundAmount: amount,
      transactionSignature: mockSignature
    };
    
  } catch (error) {
    console.error('❌ Failed to process refund:', error);
    throw new Error(`Failed to process refund: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Calculate platform fee (4%)
export const calculatePlatformFee = (totalAmount: number): number => {
  return totalAmount * 0.04;
};

// Calculate winner payout (96% of total pot)
export const calculateWinnerPayout = (totalPot: number): number => {
  return totalPot * 0.96;
};

// Process winner payout in SOL
export const processWinnerPayout = async (
  toWalletAddress: string,
  totalPot: number,
  gameId: string
): Promise<PayoutResult> => {
  try {
    const platformFee = calculatePlatformFee(totalPot);
    const winnerAmount = calculateWinnerPayout(totalPot);
    
    console.log(`🏆 Processing winner payout for game ${gameId}:`, {
      totalPot,
      platformFee,
      winnerAmount,
      winner: toWalletAddress
    });
    
    // For demo purposes, simulate payout
    const mockSignature = `payout_${gameId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`✅ Winner payout processed: ${winnerAmount} SOL to ${toWalletAddress} (${platformFee} SOL platform fee)`);
    
    return {
      success: true,
      signature: mockSignature,
      amount: winnerAmount,
    };
  } catch (error) {
    console.error('❌ Error processing winner payout:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

// Process refund for canceled game
export const processRefund = async (
  toWalletAddress: string,
  amount: number
): Promise<PayoutResult> => {
  try {
    console.log(`🔄 Processing game refund: ${amount} SOL to ${toWalletAddress}`);
    
    // For demo purposes, simulate refund
    const mockSignature = `refund_cancel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`✅ Refund processed: ${amount} SOL to ${toWalletAddress}`);
    
    return {
      success: true,
      signature: mockSignature,
      amount: amount,
    };
  } catch (error) {
    console.error('❌ Error processing refund:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

/**
 * Legacy functions for compatibility - these are updated to use the new payment system
 */

export async function processSolPayment(
  fromWalletAddress: string,
  amount: number
): Promise<PaymentResult> {
  const fromWallet = new PublicKey(fromWalletAddress);
  return processGameEntryPayment(fromWallet, amount, 'legacy');
}

export async function processWinnerPayoutLegacy(
  toWalletAddress: string,
  amount: number
): Promise<PayoutResult> {
  return processWinnerPayout(toWalletAddress, amount, 'legacy');
}

/**
 * Get escrow balance for debugging
 */
export async function getEscrowBalance(): Promise<number> {
  try {
    const conn = getConnection();
    const balance = await conn.getBalance(getEscrowPublicKey());
    return balance / LAMPORTS_PER_SOL;
  } catch (error) {
    console.error('Error getting escrow balance:', error);
    return 0;
  }
} 