'use client';

import { FC, useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import { PlayArrow as PlayIcon, Lock as LockIcon, Public as PublicIcon } from '@mui/icons-material';

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
  current_players: number;
  player_status?: string;
}

export const LobbyList: FC = () => {
  const { publicKey } = useWallet();
  const router = useRouter();
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLobbies = useCallback(async () => {
    if (!publicKey) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/lobbies?walletAddress=${publicKey.toString()}`);
      
      if (response.ok) {
        const data = await response.json();
        setLobbies(data);
      } else {
        setError('Failed to fetch lobbies');
      }
    } catch (error) {
      console.error('Error fetching lobbies:', error);
      setError('Failed to fetch lobbies');
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    if (publicKey) {
      fetchLobbies();
    }
  }, [publicKey, fetchLobbies]);

  const handleJoinLobby = async (lobby: Lobby) => {
    if (!publicKey) return;

    try {
      const response = await fetch(`/api/lobbies/${lobby.id}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: publicKey.toString(),
        }),
      });

      if (response.ok) {
        // Navigate to the lobby page
        router.push(`/lobby/${lobby.id}`);
      } else {
        const error = await response.json();
        setError(error.error || 'Failed to join lobby');
      }
    } catch (error) {
      console.error('Error joining lobby:', error);
      setError('Failed to join lobby');
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
      case 'invited':
        return 'warning';
      case 'waiting':
        return 'info';
      default:
        return 'default';
    }
  };

  if (!publicKey) {
    return (
      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          Connect your wallet to see available lobbies
        </Typography>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ mt: 4 }}>
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 6, mb: 4 }}>
      <Typography variant="h4" gutterBottom align="center">
        Available Lobbies
      </Typography>
      
      {lobbies.length === 0 ? (
        <Box sx={{ textAlign: 'center', mt: 4 }}>
          <Typography variant="h6" color="text.secondary">
            No lobbies available. Create one to get started!
          </Typography>
        </Box>
      ) : (
        <Box sx={{ 
          display: 'grid', 
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
          gap: 3,
          mt: 2 
        }}>
          {lobbies.map((lobby) => (
            <Card 
              key={lobby.id}
              sx={{ 
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: 'transform 0.2s',
                cursor: 'pointer',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: 6,
                }
              }}
              onClick={() => handleJoinLobby(lobby)}
            >
              <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h4" sx={{ mr: 1 }}>
                    {getGameIcon(lobby.game_type)}
                  </Typography>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" component="h3">
                      {lobby.game_type.charAt(0).toUpperCase() + lobby.game_type.slice(1)}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {lobby.is_private ? (
                        <LockIcon fontSize="small" color="action" />
                      ) : (
                        <PublicIcon fontSize="small" color="action" />
                      )}
                      <Typography variant="body2" color="text.secondary">
                        {lobby.is_private ? 'Private' : 'Public'}
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Created by {lobby.creator_name}
                  </Typography>
                  <Typography variant="h6" color="primary" gutterBottom>
                    {lobby.entry_fee} SOL
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                    <Chip 
                      label={`${lobby.current_players}/${lobby.max_players} Players`}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                    {lobby.player_status && (
                      <Chip 
                        label={lobby.player_status}
                        size="small"
                        color={getStatusColor(lobby.player_status) as 'success' | 'warning' | 'info' | 'default'}
                      />
                    )}
                  </Box>
                </Box>

                <Box sx={{ mt: 'auto' }}>
                  {lobby.player_status === 'ready' ? (
                    <Button
                      variant="contained"
                      fullWidth
                      disabled
                      startIcon={<PlayIcon />}
                    >
                      Ready
                    </Button>
                  ) : lobby.player_status === 'invited' ? (
                    <Button
                      variant="contained"
                      fullWidth
                      onClick={() => handleJoinLobby(lobby)}
                      startIcon={<PlayIcon />}
                    >
                      Accept Invitation
                    </Button>
                  ) : lobby.current_players >= lobby.max_players ? (
                    <Button
                      variant="outlined"
                      fullWidth
                      disabled
                    >
                      Full
                    </Button>
                  ) : (
                    <Button
                      variant="contained"
                      fullWidth
                      onClick={() => handleJoinLobby(lobby)}
                      startIcon={<PlayIcon />}
                    >
                      Join Lobby
                    </Button>
                  )}
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}
    </Box>
  );
}; 