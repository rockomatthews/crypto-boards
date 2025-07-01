'use client';

import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Chip
} from '@mui/material';
import { useWallet } from '@solana/wallet-adapter-react';
import { 
  Connection, 
  PublicKey, 
  Transaction, 
  SystemProgram,
  LAMPORTS_PER_SOL 
} from '@solana/web3.js';

interface EscrowPaymentProps {
  gameId: string;
  entryFee: string | number;
  onPaymentSuccess: (transactionSignature: string) => void;
  onPaymentError: (error: string) => void;
}

// Platform wallet where funds are sent - YOUR WALLET FROM ENVIRONMENT VARIABLES
const PLATFORM_WALLET = new PublicKey(
  process.env.NEXT_PUBLIC_PLATFORM_WALLET_ADDRESS || 
  'CHyQpdkGgoQbQDdm9vgjc3NpiBQ9wQ8Fu8LHQaPwoNdN' // Fallback to your wallet
);

export const EscrowPayment: React.FC<EscrowPaymentProps> = ({
  gameId,
  entryFee,
  onPaymentSuccess,
  onPaymentError
}) => {
  const { publicKey, sendTransaction } = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [userBalance, setUserBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const entryFeeNumber = typeof entryFee === 'string' ? parseFloat(entryFee) : entryFee;

  // Load user's SOL balance
  React.useEffect(() => {
    const loadBalance = async () => {
      if (!publicKey) return;
      
      setBalanceLoading(true);
      try {
        const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://rpc.ankr.com/solana';
        const connection = new Connection(rpcUrl, 'confirmed');
        const balance = await connection.getBalance(publicKey);
        setUserBalance(balance / LAMPORTS_PER_SOL);
      } catch (error) {
        console.error('Error loading balance:', error);
        setUserBalance(null);
      } finally {
        setBalanceLoading(false);
      }
    };

    loadBalance();
  }, [publicKey]);

  const formatSOL = (amount: number | string): string => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return `${num.toFixed(4)} SOL`;
  };

  const handleEscrowPayment = async () => {
    if (!publicKey || !sendTransaction) {
      onPaymentError('Wallet not connected');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Use QuickNode from environment variable!
      const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://rpc.ankr.com/solana';
      const connection = new Connection(rpcUrl, 'confirmed');

      console.log(`💳 Creating REAL MAINNET transaction for ${entryFeeNumber} SOL...`);
      console.log(`🔗 Using RPC: ${rpcUrl.includes('quiknode') ? 'QuickNode (Premium)' : 'Fallback RPC'}`);
      console.log(`💰 Sending to platform wallet: ${PLATFORM_WALLET.toString()}`);

      // 🔍 CRITICAL: Check user's SOL balance BEFORE creating transaction
      const userBalance = await connection.getBalance(publicKey);
      const userBalanceSOL = userBalance / LAMPORTS_PER_SOL;
      const requiredAmount = entryFeeNumber;
      const estimatedGasFee = 0.00001; // Typical gas fee
      const totalRequired = requiredAmount + estimatedGasFee;

      console.log(`💰 Balance check:`, {
        userBalance: `${userBalanceSOL.toFixed(6)} SOL`,
        entryFee: `${requiredAmount.toFixed(6)} SOL`, 
        estimatedGas: `${estimatedGasFee.toFixed(6)} SOL`,
        totalRequired: `${totalRequired.toFixed(6)} SOL`,
        sufficient: userBalanceSOL >= totalRequired
      });

      if (userBalanceSOL < totalRequired) {
        const shortfall = totalRequired - userBalanceSOL;
        throw new Error(
          `Insufficient SOL balance! You need ${totalRequired.toFixed(6)} SOL but only have ${userBalanceSOL.toFixed(6)} SOL. ` +
          `Please add ${shortfall.toFixed(6)} SOL to your wallet and try again.`
        );
      }

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: PLATFORM_WALLET,
          lamports: entryFeeNumber * LAMPORTS_PER_SOL,
        })
      );

      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // 🔍 SIMULATE transaction before asking user to sign
      try {
        const simulation = await connection.simulateTransaction(transaction);
        
        if (simulation.value.err) {
          console.error('❌ Transaction simulation failed:', simulation.value.err);
          throw new Error(`Transaction would fail: ${JSON.stringify(simulation.value.err)}`);
        }
        
        console.log('✅ Transaction simulation successful');
      } catch (simError) {
        console.error('❌ Failed to simulate transaction:', simError);
        throw new Error(`Transaction simulation failed - this would likely cause wallet to warn about revert`);
      }

      console.log('📝 Asking user to sign MAINNET transaction...');

      const signature = await sendTransaction(transaction, connection);
      
      console.log(`⏳ MAINNET Transaction sent: ${signature}`);

      const confirmation = await connection.confirmTransaction(signature, 'confirmed');
      
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${confirmation.value.err}`);
      }

      console.log(`✅ MAINNET Transaction confirmed: ${signature}`);

      // Record in database
      const response = await fetch(`/api/games/${gameId}/escrow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_escrow',
          playerWallet: publicKey.toString(),
          amount: entryFeeNumber,
          transactionData: {
            signature: signature,
            confirmed: true
          }
        })
      });

      if (response.ok) {
        setSuccess(true);
        onPaymentSuccess(signature);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        const errorData = await response.json();
        throw new Error(`Database error: ${errorData.error}`);
      }

    } catch (error: unknown) {
      console.error('❌ Payment error:', error);
      
      let errorMessage = 'Payment failed';
      if (error instanceof Error) {
        if (error.message?.includes('User rejected')) {
          errorMessage = 'Transaction was cancelled';
        } else if (error.message?.includes('insufficient funds')) {
          errorMessage = 'Insufficient SOL balance';
        } else {
          errorMessage = error.message;
        }
      }
      
      setError(errorMessage);
      onPaymentError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const totalPot = entryFeeNumber * 2;
  const winnerAmount = totalPot - (totalPot * 0.04);
  const hasInsufficientBalance = userBalance !== null && userBalance < (entryFeeNumber + 0.00001);

  if (success) {
    return (
      <Paper sx={{ p: 3, bgcolor: '#e8f5e8', border: '2px solid #4caf50' }}>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h6" sx={{ color: '#2e7d32', fontWeight: 'bold', mb: 1 }}>
            ✅ Payment Successful!
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Your {formatSOL(entryFeeNumber)} has been sent to escrow.
          </Typography>
        </Box>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3, bgcolor: '#fff3e0', border: '2px solid #ff9800' }}>
      <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, color: '#8B4513' }}>
        💰 MAINNET SOL Payment Required
      </Typography>
      
      <Box sx={{ mb: 2 }}>
        <Typography variant="body1" sx={{ mb: 1 }}>
          <strong>Entry Fee:</strong> {formatSOL(entryFeeNumber)}
        </Typography>
        
        {/* User Balance Display */}
        <Box sx={{ p: 2, bgcolor: '#f5f5f5', borderRadius: 1, mb: 2 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Your Wallet Balance:</strong>{' '}
            {balanceLoading ? (
              <CircularProgress size={12} sx={{ ml: 1 }} />
            ) : userBalance !== null ? (
              <span style={{ 
                color: userBalance >= (entryFeeNumber + 0.00001) ? '#2e7d32' : '#d32f2f',
                fontWeight: 'bold'
              }}>
                {userBalance.toFixed(6)} SOL
              </span>
            ) : (
              'Unable to load'
            )}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Required: {(entryFeeNumber + 0.00001).toFixed(6)} SOL (entry fee + gas)
          </Typography>
          {userBalance !== null && userBalance < (entryFeeNumber + 0.00001) && (
            <Alert severity="warning" sx={{ mt: 1 }}>
              ⚠️ Insufficient balance! You need {((entryFeeNumber + 0.00001) - userBalance).toFixed(6)} more SOL
            </Alert>
          )}
        </Box>
        
        <Typography variant="body2" color="error" sx={{ mb: 1, fontWeight: 'bold' }}>
          🚨 MAINNET TRANSACTION - REAL SOL WILL BE SENT 🚨
        </Typography>
        <Typography variant="body2" color="error" sx={{ mb: 1, fontWeight: 'bold' }}>
          💳 You will be asked to approve this transaction in Phantom
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Funds go to: {PLATFORM_WALLET.toString().slice(0, 20)}...
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          <Chip label={`Total Pot: ${formatSOL(totalPot)}`} color="primary" size="small" />
          <Chip label={`Winner Gets: ${formatSOL(winnerAmount)}`} color="success" size="small" />
          <Chip label={`Platform Fee: 4%`} color="default" size="small" />
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <Button
          variant="contained"
          onClick={handleEscrowPayment}
          disabled={loading || !publicKey || hasInsufficientBalance}
          sx={{
            bgcolor: hasInsufficientBalance ? '#757575' : '#d32f2f',
            '&:hover': { 
              bgcolor: hasInsufficientBalance ? '#757575' : '#b71c1c' 
            },
            fontWeight: 'bold',
            px: 4
          }}
        >
          {loading ? (
            <>
              <CircularProgress size={20} sx={{ mr: 1, color: 'white' }} />
              Processing Transaction...
            </>
          ) : hasInsufficientBalance ? (
            <>⚠️ Insufficient SOL Balance</>
          ) : (
            <>💳 Send {formatSOL(entryFeeNumber)} SOL</>
          )}
        </Button>
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block', textAlign: 'center' }}>
        🔐 Real blockchain transaction required
      </Typography>
    </Paper>
  );
}; 