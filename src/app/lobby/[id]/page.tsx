'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  CircularProgress,
  Alert,
  Divider,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
} from '@mui/material';
import { 
  PlayArrow as PlayIcon, 
  Lock as LockIcon,
  Public as PublicIcon,
  Cancel as CancelIcon,
  ExitToApp as LeaveIcon 
} from '@mui/icons-material';
import { EscrowPayment } from '@/components/EscrowPayment';

interface LobbyPlayer {
  id: string;
  username: string;
  wallet_address: string;
  avatar_url: string;
  game_status: 'waiting' | 'ready' | 'invited';
  joined_at: string;
}

interface Lobby {
  id: string;
  game_type: string;
  status: string;
  max_players: number;
  entry_fee: number;
  is_private: boolean;
  created_at: string;
  creator_name: string;
  creator_wallet: string;
  players: LobbyPlayer[];
}

export default function LobbyPage() {
  const params = useParams();
  const router = useRouter();
  const { publicKey } = useWallet();
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const lobbyId = params.id as string;

  const fetchLobby = useCallback(async () => {
    try {
      const response = await fetch(`/api/lobbies/${lobbyId}`);
      if (response.ok) {
        const data = await response.json();
        
        // If the game has started, navigate to the game
        if (data.status === 'in_progress') {
          router.push(`/${data.game_type}/${lobbyId}`);
          return;
        }
        
        setLobby(data);
      } else {
        setError('Failed to fetch lobby');
      }
    } catch (error) {
      console.error('Error fetching lobby:', error);
      setError('Failed to fetch lobby');
    } finally {
      setLoading(false);
    }
  }, [lobbyId, router]);

  useEffect(() => {
    if (lobbyId) {
      fetchLobby();
      // Re-enable polling for debugging lobby issues
      const interval = setInterval(fetchLobby, 3000);
      return () => clearInterval(interval);
    }
  }, [lobbyId, fetchLobby]);

  const handleStartGame = async () => {
    if (!lobby) return;

    setStarting(true);
    try {
      const response = await fetch(`/api/lobbies/${lobbyId}/start`, {
        method: 'POST',
      });

      if (response.ok) {
        // Navigate to the game
        router.push(`/${lobby.game_type}/${lobbyId}`);
      } else {
        const error = await response.json();
        setError(error.error || 'Failed to start game');
      }
    } catch (error) {
      console.error('Error starting game:', error);
      setError('Failed to start game');
    } finally {
      setStarting(false);
    }
  };

  const handleCancelOrLeaveGame = async () => {
    if (!publicKey || !lobby) return;

    setShowCancelDialog(false);
    setCanceling(true);
    try {
      const response = await fetch(`/api/lobbies/${lobbyId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: publicKey.toString(),
        }),
      });

      if (response.ok) {
        const result = await response.json();
        
        if (isCreator) {
          // Game was canceled, show refund info and redirect
          if (result.refunds && result.refunds.length > 0) {
            alert(`Game canceled successfully! ${result.refunds.length} refunds processed.`);
          } else {
            alert('Game canceled successfully!');
          }
          router.push('/');
        } else {
          // Player left the game
          if (result.refund) {
            alert(`Successfully left the game! Refund of ${result.refund.amount} SOL processed.`);
          } else {
            alert('Successfully left the game!');
          }
          router.push('/');
        }
      } else {
        const error = await response.json();
        setError(error.error || 'Failed to cancel/leave game');
      }
    } catch (error) {
      console.error('Error canceling/leaving game:', error);
      setError('Failed to cancel/leave game');
    } finally {
      setCanceling(false);
    }
  };

  const getGameIcon = (gameType: string) => {
    switch (gameType.toLowerCase()) {
      case 'checkers':
        return '♟️';
      case 'chess':
        return '♔';
      case 'go':
        return '⚫';
      case 'poker':
        return '🃏';
      default:
        return '🎮';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready':
        return 'success';
      case 'waiting':
        return 'warning';
      case 'invited':
        return 'info';
      default:
        return 'default';
    }
  };

  const isCreator = publicKey && lobby?.creator_wallet === publicKey.toString();
  const currentPlayer = lobby?.players.find(p => p.wallet_address === publicKey?.toString());
  const allPlayersReady = lobby && lobby.players.length >= 2 && lobby.players.every(p => p.game_status === 'ready');
  const canStart = isCreator && allPlayersReady;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Box>
    );
  }

  if (!lobby) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Lobby not found</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
      {/* Lobby Header */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Typography variant="h3" sx={{ mr: 2 }}>
              {getGameIcon(lobby.game_type)}
            </Typography>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h4" gutterBottom>
                {lobby.game_type.charAt(0).toUpperCase() + lobby.game_type.slice(1)} Lobby
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {lobby.is_private ? (
                  <Chip icon={<LockIcon />} label="Private" color="primary" />
                ) : (
                  <Chip icon={<PublicIcon />} label="Public" color="default" />
                )}
                <Typography variant="body2" color="text.secondary">
                  Created by {lobby.creator_name}
                </Typography>
              </Box>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Chip label={`${lobby.players.length}/${lobby.max_players} Players`} />
            <Chip label={`${lobby.entry_fee} SOL Entry Fee`} color="primary" />
            <Chip label={lobby.status} color="info" />
          </Box>
        </CardContent>
      </Card>

      {/* Players List */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Players ({lobby.players.length}/{lobby.max_players})
          </Typography>
          <List>
            {lobby.players.map((player, index) => (
              <Box key={player.id}>
                <ListItem>
                  <ListItemAvatar>
                    <Avatar src={player.avatar_url}>
                      {player.username.charAt(0)}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {player.username}
                        {player.wallet_address === lobby.creator_wallet && (
                          <Chip label="Creator" size="small" color="primary" />
                        )}
                      </Box>
                    }
                    secondary={player.wallet_address.slice(0, 8) + '...'}
                  />
                  <Chip
                    label={player.game_status}
                    color={getStatusColor(player.game_status) as 'success' | 'warning' | 'info' | 'default'}
                    size="small"
                  />
                </ListItem>
                {index < lobby.players.length - 1 && <Divider />}
              </Box>
            ))}
          </List>
        </CardContent>
      </Card>

      {/* Debug Info */}
      <Card sx={{ mb: 3, bgcolor: '#f0f0f0' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom color="error">🐛 Debug Info</Typography>
          <Typography variant="body2">Is Creator: {isCreator ? 'YES' : 'NO'}</Typography>
          <Typography variant="body2">Current Player: {currentPlayer ? currentPlayer.username : 'NOT IN GAME'}</Typography>
          <Typography variant="body2">Player Status: {currentPlayer?.game_status || 'N/A'}</Typography>
          <Typography variant="body2">Players Ready: {lobby?.players.filter(p => p.game_status === 'ready').length}/{lobby?.players.length}</Typography>
          <Typography variant="body2">All Ready: {allPlayersReady ? 'YES' : 'NO'}</Typography>
          <Typography variant="body2">Can Start: {canStart ? 'YES' : 'NO'}</Typography>
          <Typography variant="body2">Lobby Status: {lobby?.status}</Typography>
        </CardContent>
      </Card>

      {/* Payment Section */}
      {currentPlayer?.game_status === 'waiting' && (
        <Box sx={{ mb: 3 }}>
          <EscrowPayment
            gameId={lobbyId}
            entryFee={lobby.entry_fee}
            onPaymentSuccess={async () => {
              // Update player status to ready after successful payment
              const response = await fetch(`/api/lobbies/${lobbyId}/pay`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  walletAddress: publicKey?.toString(),
                  transactionSignature: 'escrow_payment_' + Date.now(),
                }),
              });

              if (response.ok) {
                console.log('✅ Payment verified and player marked as ready');
                await fetchLobby(); // Refresh lobby data
              } else {
                const error = await response.json();
                setError(error.error || 'Failed to verify payment');
              }
            }}
            onPaymentError={(error) => {
              setError(error);
            }}
          />
        </Box>
      )}

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        {currentPlayer?.game_status === 'ready' && (
          <Button
            variant="outlined"
            size="large"
            disabled
            sx={{ minWidth: 200 }}
          >
            Ready ✓
          </Button>
        )}

        {canStart && (
          <Button
            variant="contained"
            size="large"
            startIcon={<PlayIcon />}
            onClick={handleStartGame}
            disabled={starting}
            color="success"
            sx={{ minWidth: 200 }}
          >
            {starting ? 'Starting...' : 'Start Game'}
          </Button>
        )}

        {!currentPlayer && lobby.players.length < lobby.max_players && (
          <Button
            variant="contained"
            size="large"
            onClick={async () => {
              if (!publicKey) return;
              try {
                const response = await fetch(`/api/lobbies/${lobbyId}/join`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    walletAddress: publicKey.toString(),
                  }),
                });

                if (response.ok) {
                  await fetchLobby(); // Refresh lobby data
                } else {
                  const error = await response.json();
                  setError(error.error || 'Failed to join lobby');
                }
              } catch (error) {
                console.error('Error joining lobby:', error);
                setError('Failed to join lobby');
              }
            }}
            sx={{ minWidth: 200 }}
          >
            Join Lobby
          </Button>
        )}

        {!currentPlayer && lobby.players.length >= lobby.max_players && (
          <Button
            variant="outlined"
            size="large"
            disabled
            sx={{ minWidth: 200 }}
          >
            Lobby Full
          </Button>
        )}

        {!currentPlayer && (
          <Button
            variant="outlined"
            size="large"
            onClick={() => router.push('/')}
            sx={{ minWidth: 200 }}
          >
            Back to Lobbies
          </Button>
        )}

        {currentPlayer && lobby.status === 'waiting' && (
          <Button
            variant="outlined"
            size="large"
            startIcon={isCreator ? <CancelIcon /> : <LeaveIcon />}
            onClick={() => setShowCancelDialog(true)}
            disabled={canceling}
            color="error"
            sx={{ minWidth: 200 }}
          >
            {canceling ? 'Processing...' : (isCreator ? 'Cancel Game' : 'Leave Game')}
          </Button>
        )}
      </Box>

      {/* Game Start Info */}
      {lobby && lobby.players.length >= 2 && lobby.players.every(p => p.game_status === 'ready') && !canStart && (
        <Paper sx={{ p: 2, mt: 2, bgcolor: 'success.light', color: 'white' }}>
          <Typography variant="body1">
            All {lobby.players.length} players are ready! Waiting for the creator to start the game.
          </Typography>
        </Paper>
      )}

      {lobby && lobby.players.length === 1 && lobby.players[0].game_status === 'ready' && (
        <Paper sx={{ p: 2, mt: 2, bgcolor: 'info.light', color: 'white' }}>
          <Typography variant="body1">
            Waiting for more players to join. Need at least 2 players to start.
          </Typography>
        </Paper>
      )}

      {/* Cancel/Leave Game Confirmation Dialog */}
      <Dialog
        open={showCancelDialog}
        onClose={() => setShowCancelDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {isCreator ? 'Cancel Game?' : 'Leave Game?'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {isCreator 
              ? 'Are you sure you want to cancel this game? All players who have paid will receive full refunds.'
              : 'Are you sure you want to leave this game? If you have paid the entry fee, you will receive a full refund.'
            }
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCancelDialog(false)}>
            Keep Playing
          </Button>
          <Button 
            onClick={handleCancelOrLeaveGame} 
            color="error" 
            variant="contained"
            disabled={canceling}
          >
            {canceling ? 'Processing...' : (isCreator ? 'Cancel Game' : 'Leave Game')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
} 