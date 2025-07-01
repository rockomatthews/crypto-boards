'use client';

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  Alert
} from '@mui/material';
import { CheckCircle, EmojiEvents } from '@mui/icons-material';

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
  escrowReleased?: boolean;
  escrowTransactionSignature?: string;
  winnerAmount?: number;
  platformFee?: number;
}

export default function GameEndModal({
  open,
  onClose,
  winner,
  isDraw = false,
  totalPot = 0,
  escrowReleased = false,
  escrowTransactionSignature,
  winnerAmount,
  platformFee: providedPlatformFee
}: Omit<GameEndModalProps, 'entryFee' | 'playerCount' | 'gameId'>) {
  // Calculate amounts if not provided
  const calculatedWinnerShare = winnerAmount || (totalPot * 0.96); // 96% of pot
  const calculatedPlatformFee = providedPlatformFee || (totalPot * 0.04); // 4% platform fee
  
  // Show automatic payout status instead of manual processing
  const payoutStatus = escrowReleased ? {
    success: true,
    message: `🎉 Automatic payout complete! Winner received ${calculatedWinnerShare} SOL.`,
    transactionSignature: escrowTransactionSignature,
    amount: calculatedWinnerShare
  } : {
    success: false,
    message: "⏳ Payout processing... This may take a moment.",
    transactionSignature: undefined,
    amount: calculatedWinnerShare
  };

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
                  <Chip label={`${totalPot.toFixed(4)} SOL`} color="primary" />
                </Box>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography>Winner&apos;s Share (96%):</Typography>
                  <Chip label={`${calculatedWinnerShare.toFixed(4)} SOL`} color="success" />
                </Box>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography>Platform Fee (4%):</Typography>
                  <Chip label={`${calculatedPlatformFee.toFixed(4)} SOL`} color="default" />
                </Box>
              </Box>
              <Box sx={{ mt: 2, p: 1, bgcolor: 'rgba(255,193,7,0.1)', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary" align="center" display="block">
                  ⚠️ Note: Small gas fees (~0.0000008 SOL) are charged for blockchain transactions
                </Typography>
              </Box>
            </Box>

            <Alert 
              severity={payoutStatus.success ? 'success' : 'info'}
              sx={{ mb: 2 }}
            >
              {payoutStatus.message}
              {payoutStatus.transactionSignature && (
                <Typography variant="caption" display="block" mt={1}>
                  Transaction: {payoutStatus.transactionSignature.slice(0, 20)}...
                </Typography>
              )}
            </Alert>

            {escrowReleased && (
              <Box textAlign="center">
                <Button
                  variant="contained"
                  color="success"
                  size="large"
                  startIcon={<CheckCircle />}
                  disabled
                  sx={{ minWidth: 200 }}
                >
                  ✅ Payout Complete
                </Button>
              </Box>
            )}
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
        {escrowReleased && (
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