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

interface EscrowPaymentProps {
  gameId: string;
  entryFee: number;
  onPaymentSuccess: () => void;
  onPaymentError: (error: string) => void;
}

export const EscrowPayment: React.FC<EscrowPaymentProps> = ({
  gameId,
  entryFee,
  onPaymentSuccess,
  onPaymentError
}) => {
  const { publicKey, signTransaction } = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleEscrowPayment = async () => {
    if (!publicKey || !signTransaction) {
      onPaymentError('Wallet not connected');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create escrow transaction
      const response = await fetch(`/api/games/${gameId}/escrow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_escrow',
          playerWallet: publicKey.toString(),
          amount: entryFee,
          transactionData: {
            signature: `temp_${Date.now()}` // This would be replaced with actual transaction
          }
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Escrow created:', result);
        
        setSuccess(true);
        onPaymentSuccess();
        
        // Show success for a moment then hide
        setTimeout(() => {
          setSuccess(false);
        }, 3000);
        
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create escrow');
      }

    } catch (error) {
      console.error('❌ Escrow payment error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(errorMessage);
      onPaymentError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const totalPot = entryFee * 2; // Assuming 2 players
  const winnerAmount = totalPot - (totalPot * 0.04);

  if (success) {
    return (
      <Paper sx={{ p: 3, bgcolor: '#e8f5e8', border: '2px solid #4caf50' }}>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h6" sx={{ color: '#2e7d32', fontWeight: 'bold', mb: 1 }}>
            ✅ Payment Successful!
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Your {entryFee.toFixed(4)} SOL has been placed in escrow.
          </Typography>
        </Box>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3, bgcolor: '#fff3e0', border: '2px solid #ff9800' }}>
      <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, color: '#8B4513' }}>
        💰 Game Entry Payment
      </Typography>
      
      <Box sx={{ mb: 2 }}>
        <Typography variant="body1" sx={{ mb: 1 }}>
          <strong>Entry Fee:</strong> {entryFee.toFixed(4)} SOL
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Your SOL will be held in escrow until the game ends.
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          <Chip 
            label={`Total Pot: ${totalPot.toFixed(4)} SOL`}
            color="primary" 
            size="small" 
          />
          <Chip 
            label={`Winner Gets: ${winnerAmount.toFixed(4)} SOL`}
            color="success" 
            size="small" 
          />
          <Chip 
            label={`Platform Fee: 4%`}
            color="default" 
            size="small" 
          />
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
          disabled={loading || !publicKey}
          sx={{
            bgcolor: '#2e7d32',
            '&:hover': { bgcolor: '#1b5e20' },
            fontWeight: 'bold',
            px: 4
          }}
        >
          {loading ? (
            <>
              <CircularProgress size={20} sx={{ mr: 1, color: 'white' }} />
              Processing...
            </>
          ) : (
            <>💳 Pay {entryFee.toFixed(4)} SOL</>
          )}
        </Button>
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block', textAlign: 'center' }}>
        🔒 Funds are held securely in escrow and automatically released to the winner
      </Typography>
    </Paper>
  );
}; 