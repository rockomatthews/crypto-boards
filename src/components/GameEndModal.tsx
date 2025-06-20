'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  CircularProgress,
  Alert
} from '@mui/material';
import { CheckCircle, EmojiEvents, Payment } from '@mui/icons-material';

interface GameEndModalProps {
  open: boolean;
  onClose: () => void;
  gameId: string;
  winner?: {
    username: string;
    walletAddress: string;
  };
  isDraw?: boolean;
  totalPot?: number;
  entryFee?: number;
  playerCount?: number;
}

export default function GameEndModal({
  open,
  onClose,
  gameId,
  winner,
  isDraw = false,
  totalPot = 0
}: Omit<GameEndModalProps, 'entryFee' | 'playerCount'>) {
  const [isProcessingPayout, setIsProcessingPayout] = useState(false);
  const [payoutResult, setPayoutResult] = useState<{
    success: boolean;
    message: string;
    transactionSignature?: string;
    amount?: number;
  } | null>(null);

  const handlePayout = async () => {
    if (!winner) return;

    setIsProcessingPayout(true);
    setPayoutResult(null);

    try {
      const response = await fetch(`/api/games/${gameId}/payout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (response.ok) {
        setPayoutResult({
          success: true,
          message: result.message,
          transactionSignature: result.transactionSignature,
          amount: result.amount
        });
      } else {
        setPayoutResult({
          success: false,
          message: result.error || 'Payout failed'
        });
      }
    } catch {
      setPayoutResult({
        success: false,
        message: 'Network error occurred'
      });
    } finally {
      setIsProcessingPayout(false);
    }
  };

  const winnerShare = totalPot * 0.9; // 90% of pot
  const platformFee = totalPot * 0.1; // 10% platform fee

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ textAlign: 'center', pb: 1 }}>
        <Box display="flex" alignItems="center" justifyContent="center" gap={1}>
          {isDraw ? (
            <>
              <Typography variant="h5">Game Ended in Draw</Typography>
            </>
          ) : (
            <>
              <EmojiEvents sx={{ color: 'gold', fontSize: 32 }} />
              <Typography variant="h5">Game Over!</Typography>
            </>
          )}
        </Box>
      </DialogTitle>

      <DialogContent>
        {isDraw ? (
          <Box textAlign="center" py={2}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              The game ended in a draw
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Both players played well! Entry fees will be returned.
            </Typography>
          </Box>
        ) : winner ? (
          <Box>
            <Box textAlign="center" mb={3}>
              <Typography variant="h6" color="primary" gutterBottom>
                🎉 Congratulations! 🎉
              </Typography>
              <Typography variant="h5" fontWeight="bold" color="success.main">
                {winner.username}
              </Typography>
              <Typography variant="body1" color="text.secondary">
                is the winner!
              </Typography>
            </Box>

            <Box mb={3}>
              <Typography variant="h6" gutterBottom>
                Prize Breakdown
              </Typography>
              <Box display="flex" flexDirection="column" gap={1}>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography>Total Pot:</Typography>
                  <Chip label={`${totalPot} SOL`} color="primary" />
                </Box>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography>Winner&apos;s Share (90%):</Typography>
                  <Chip label={`${winnerShare} SOL`} color="success" />
                </Box>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography>Platform Fee (10%):</Typography>
                  <Chip label={`${platformFee} SOL`} color="default" />
                </Box>
              </Box>
            </Box>

            {payoutResult && (
              <Alert 
                severity={payoutResult.success ? 'success' : 'error'}
                sx={{ mb: 2 }}
              >
                {payoutResult.message}
                {payoutResult.transactionSignature && (
                  <Typography variant="caption" display="block" mt={1}>
                    Transaction: {payoutResult.transactionSignature}
                  </Typography>
                )}
              </Alert>
            )}

            <Box textAlign="center">
              <Button
                variant="contained"
                color="success"
                size="large"
                startIcon={isProcessingPayout ? <CircularProgress size={20} /> : <Payment />}
                onClick={handlePayout}
                disabled={isProcessingPayout || payoutResult?.success}
                sx={{ minWidth: 200 }}
              >
                {isProcessingPayout ? 'Processing Payout...' : 'Process Winner Payout'}
              </Button>
            </Box>
          </Box>
        ) : (
          <Box textAlign="center" py={2}>
            <Typography variant="body1" color="text.secondary">
              Game ended but winner information is not available.
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 0 }}>
        <Button onClick={onClose} variant="outlined">
          Close
        </Button>
        {payoutResult?.success && (
          <Button
            variant="contained"
            color="success"
            startIcon={<CheckCircle />}
            onClick={onClose}
          >
            Done
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
} 