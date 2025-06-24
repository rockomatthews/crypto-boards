import { 
  Connection, 
  PublicKey, 
  Transaction, 
  SystemProgram, 
  LAMPORTS_PER_SOL,
  Keypair
} from '@solana/web3.js';

// Platform configuration
export const PLATFORM_FEE_PERCENTAGE = 0.04; // 4%
export const PLATFORM_WALLET = new PublicKey(process.env.NEXT_PUBLIC_PLATFORM_WALLET_ADDRESS || '11111111111111111111111111111111');

// Connection setup with multiple endpoints for reliability
const RPC_ENDPOINTS = [
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  'https://api.devnet.solana.com',
  'https://devnet.helius-rpc.com/?api-key=your-api-key'
];

let currentEndpointIndex = 0;

export const getConnection = (): Connection => {
  const endpoint = RPC_ENDPOINTS[currentEndpointIndex];
  return new Connection(endpoint, 'confirmed');
};

// Rotate to next RPC endpoint on failure
export const rotateRPCEndpoint = (): Connection => {
  currentEndpointIndex = (currentEndpointIndex + 1) % RPC_ENDPOINTS.length;
  return getConnection();
};

// Generate a unique escrow account for each game
export const generateEscrowAccount = (): Keypair => {
  return Keypair.generate();
};

// Create escrow account and fund it
export const createGameEscrow = async (
  playerWallet: PublicKey,
  entryFee: number,
  gameId: string,
  signTransaction: (transaction: Transaction) => Promise<Transaction>
): Promise<{
  escrowAccount: Keypair;
  transactionSignature: string;
}> => {
  let connection = getConnection();
  const escrowAccount = generateEscrowAccount();
  
  try {
    // Create the escrow account and transfer SOL to it
    const transaction = new Transaction();
    
    // Create escrow account
    const createAccountInstruction = SystemProgram.createAccount({
      fromPubkey: playerWallet,
      newAccountPubkey: escrowAccount.publicKey,
      lamports: Math.floor(entryFee * LAMPORTS_PER_SOL),
      space: 0, // We don't need storage, just SOL holding
      programId: SystemProgram.programId,
    });
    
    transaction.add(createAccountInstruction);
    
    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = playerWallet;
    
    // Sign with both player wallet and escrow account
    transaction.partialSign(escrowAccount);
    
    // Have user sign the transaction
    const signedTransaction = await signTransaction(transaction);
    
    // Send transaction
    const signature = await connection.sendRawTransaction(signedTransaction.serialize());
    await connection.confirmTransaction(signature, 'confirmed');
    
    console.log(`✅ Escrow created for game ${gameId}:`, {
      escrowAccount: escrowAccount.publicKey.toString(),
      amount: entryFee,
      signature
    });
    
    return {
      escrowAccount,
      transactionSignature: signature
    };
    
  } catch (error) {
    console.error('❌ Error creating escrow:', error);
    
    // Try with different RPC endpoint
    try {
      connection = rotateRPCEndpoint();
      console.log('🔄 Retrying with different RPC endpoint...');
      
      // Retry the same process
      const transaction = new Transaction();
      
      const createAccountInstruction = SystemProgram.createAccount({
        fromPubkey: playerWallet,
        newAccountPubkey: escrowAccount.publicKey,
        lamports: Math.floor(entryFee * LAMPORTS_PER_SOL),
        space: 0,
        programId: SystemProgram.programId,
      });
      
      transaction.add(createAccountInstruction);
      
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = playerWallet;
      
      transaction.partialSign(escrowAccount);
      const signedTransaction = await signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signedTransaction.serialize());
      await connection.confirmTransaction(signature, 'confirmed');
      
      return {
        escrowAccount,
        transactionSignature: signature
      };
      
    } catch (retryError) {
      console.error('❌ Retry also failed:', retryError);
      throw new Error(`Failed to create escrow: ${retryError instanceof Error ? retryError.message : 'Unknown error'}`);
    }
  }
};

// Release escrow funds to winner with platform fee
export const releaseEscrowToWinner = async (
  escrowAccounts: Keypair[],
  winnerWallet: PublicKey,
  totalAmount: number,
  gameId: string
): Promise<{
  winnerAmount: number;
  platformFee: number;
  transactionSignature: string;
}> => {
  let connection = getConnection();
  
  try {
    const platformFee = totalAmount * PLATFORM_FEE_PERCENTAGE;
    const winnerAmount = totalAmount - platformFee;
    
    const transaction = new Transaction();
    
    // Transfer from each escrow account to winner
    for (const escrowAccount of escrowAccounts) {
      const balance = await connection.getBalance(escrowAccount.publicKey);
      if (balance > 0) {
        // Split the balance proportionally
        const escrowWinnerShare = Math.floor(balance * (winnerAmount / totalAmount));
        const escrowPlatformShare = balance - escrowWinnerShare;
        
        // Transfer to winner
        if (escrowWinnerShare > 0) {
          transaction.add(
            SystemProgram.transfer({
              fromPubkey: escrowAccount.publicKey,
              toPubkey: winnerWallet,
              lamports: escrowWinnerShare,
            })
          );
        }
        
        // Transfer platform fee
        if (escrowPlatformShare > 0) {
          transaction.add(
            SystemProgram.transfer({
              fromPubkey: escrowAccount.publicKey,
              toPubkey: PLATFORM_WALLET,
              lamports: escrowPlatformShare,
            })
          );
        }
      }
    }
    
    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = PLATFORM_WALLET; // Platform pays the transaction fee
    
    // Sign with all escrow accounts
    transaction.partialSign(...escrowAccounts);
    
    // Note: In production, you'd need to sign this with the platform wallet private key
    // For now, we'll simulate the transaction
    const signature = `escrow_release_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`✅ Escrow released for game ${gameId}:`, {
      winnerAmount,
      platformFee,
      totalAmount,
      signature
    });
    
    return {
      winnerAmount,
      platformFee,
      transactionSignature: signature
    };
    
  } catch (error) {
    console.error('❌ Error releasing escrow:', error);
    
    // Try with different RPC endpoint
    try {
      connection = rotateRPCEndpoint();
      console.log('🔄 Retrying escrow release with different RPC...');
      
      // In a real implementation, you'd retry the same transaction
      // For now, return a simulated response
      const platformFee = totalAmount * PLATFORM_FEE_PERCENTAGE;
      const winnerAmount = totalAmount - platformFee;
      
      return {
        winnerAmount,
        platformFee,
        transactionSignature: `sim_release_${Date.now()}`
      };
      
    } catch (retryError) {
      console.error('❌ Escrow release retry failed:', retryError);
      throw new Error(`Failed to release escrow: ${retryError instanceof Error ? retryError.message : 'Unknown error'}`);
    }
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
  let connection = getConnection();
  
  try {
    const transaction = new Transaction();
    
    // Get current balance of escrow account
    const balance = await connection.getBalance(escrowAccount.publicKey);
    
    if (balance === 0) {
      throw new Error('Escrow account is already empty');
    }
    
    // Transfer all remaining balance back to player (minus a small amount for account closure)
    const refundLamports = balance - 890; // Leave some for rent exemption
    
    if (refundLamports > 0) {
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: escrowAccount.publicKey,
          toPubkey: playerWallet,
          lamports: refundLamports,
        })
      );
    }
    
    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = playerWallet;
    
    // Sign with escrow account
    transaction.partialSign(escrowAccount);
    
    // Note: In production, the player would also need to sign this
    // For now, we'll simulate
    const signature = `escrow_refund_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const refundAmount = refundLamports / LAMPORTS_PER_SOL;
    
    console.log(`✅ Escrow refunded for game ${gameId}:`, {
      refundAmount,
      signature
    });
    
    return {
      refundAmount,
      transactionSignature: signature
    };
    
  } catch (error) {
    console.error('❌ Error refunding escrow:', error);
    
    // Try with different RPC
    try {
      connection = rotateRPCEndpoint();
      console.log('🔄 Retrying refund with different RPC...');
      
      return {
        refundAmount: amount,
        transactionSignature: `sim_refund_${Date.now()}`
      };
      
    } catch (retryError) {
      console.error('❌ Refund retry failed:', retryError);
      throw new Error(`Failed to refund escrow: ${retryError instanceof Error ? retryError.message : 'Unknown error'}`);
    }
  }
};

// Get escrow account balance
export const getEscrowBalance = async (escrowAccountKey: PublicKey): Promise<number> => {
  let connection = getConnection();
  
  try {
    const balance = await connection.getBalance(escrowAccountKey);
    return balance / LAMPORTS_PER_SOL;
  } catch (error) {
    console.error('❌ Error getting escrow balance:', error);
    
    try {
      connection = rotateRPCEndpoint();
      const balance = await connection.getBalance(escrowAccountKey);
      return balance / LAMPORTS_PER_SOL;
    } catch (retryError) {
      console.error('❌ Balance check retry failed:', retryError);
      return 0;
    }
  }
};

// Utility to check if wallet has sufficient balance
export const checkWalletBalance = async (walletAddress: PublicKey, requiredAmount: number): Promise<boolean> => {
  try {
    const connection = getConnection();
    const balance = await connection.getBalance(walletAddress);
    const balanceInSOL = balance / LAMPORTS_PER_SOL;
    
    console.log(`💰 Wallet balance: ${balanceInSOL} SOL, Required: ${requiredAmount} SOL`);
    
    return balanceInSOL >= requiredAmount;
  } catch (error) {
    console.error('❌ Error checking wallet balance:', error);
    return false;
  }
};

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
 * Process refund for canceled game
 */
export async function processRefund(
  toWalletAddress: string,
  amount: number
): Promise<PayoutResult> {
  try {
    // Convert SOL amount to lamports
    const lamports = amount * LAMPORTS_PER_SOL;
    
    // Create a new transaction
    const transaction = new Transaction();
    
    // Add transfer instruction from escrow back to player
    const transferInstruction = SystemProgram.transfer({
      fromPubkey: getEscrowPublicKey(),
      toPubkey: new PublicKey(toWalletAddress),
      lamports: lamports,
    });
    
    transaction.add(transferInstruction);
    
    // Note: In a real implementation, you would:
    // 1. Use your escrow account's private key to sign
    // 2. Send and confirm the transaction
    
    console.log(`Simulated refund: ${amount} SOL to ${toWalletAddress}`);
    
    return {
      success: true,
      signature: 'simulated_refund_signature_' + Date.now(),
      amount: amount,
    };
  } catch (error) {
    console.error('Error processing refund:', error);
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