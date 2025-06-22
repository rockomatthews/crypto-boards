'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { Box, Typography, Alert, Button, CircularProgress } from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { CheckersBoard } from '../../../components/CheckersBoard';

interface GamePlayer {
  id: string;
  username: string;
  wallet_address: string;
  game_status: string;
}

interface Game {
  id: string;
  game_type: string;
  status: string;
  entry_fee: number;
  players: GamePlayer[];
}

export default function MultiplayerCheckersPage() {
  const params = useParams();
  const router = useRouter();
  const { publicKey } = useWallet();
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const gameId = params.id as string;

  const fetchGame = useCallback(async () => {
    try {
      const response = await fetch(`/api/games/${gameId}`);
      if (response.ok) {
        const data = await response.json();
        setGame(data);
      } else {
        setError('Failed to fetch game');
      }
    } catch (error) {
      console.error('Error fetching game:', error);
      setError('Failed to fetch game');
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    if (gameId) {
      fetchGame();
      // Poll for updates every 3 seconds
      const interval = setInterval(fetchGame, 3000);
      return () => clearInterval(interval);
    }
  }, [gameId, fetchGame]);

  const currentPlayer = game?.players.find(p => p.wallet_address === publicKey?.toString());
  const isPlayerInGame = currentPlayer && currentPlayer.game_status === 'active';
  
  // Determine player color based on join order (first player = white, second = black)
  const playerColor: 'black' | 'white' = (game?.players && game.players.length >= 2 && currentPlayer) ? 
    (game.players[0].wallet_address === currentPlayer.wallet_address ? 'white' : 'black') : 'white';

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

  if (!game) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Game not found</Alert>
      </Box>
    );
  }

  if (game.status !== 'in_progress') {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">
          Game is not in progress. Status: {game.status}
        </Alert>
      </Box>
    );
  }

  if (!isPlayerInGame) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          You are not a player in this game.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      {/* Game Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push('/')}
          sx={{ mr: 2 }}
        >
          Back to Lobbies
        </Button>
        <Typography variant="h4" sx={{ flexGrow: 1 }}>
          Checkers - {game.entry_fee} SOL Game
        </Typography>
        <Typography variant="body1" color="text.secondary">
          You are playing as {playerColor.charAt(0).toUpperCase() + playerColor.slice(1)}
        </Typography>
      </Box>

      {/* Player Information */}
      {game.players.length >= 2 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 4, mb: 3 }}>
          <Box sx={{ textAlign: 'center', p: 2, border: '1px solid #333', borderRadius: 2 }}>
            <Typography variant="h6" color="white">
              ⚪ White Player
            </Typography>
            <Typography variant="body2">
              {game.players[0]?.username || 'Player 1'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {game.players[0]?.wallet_address.slice(0, 8)}...
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center', p: 2, border: '1px solid #333', borderRadius: 2 }}>
            <Typography variant="h6" color="text.secondary">
              ⚫ Black Player
            </Typography>
            <Typography variant="body2">
              {game.players[1]?.username || 'Player 2'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {game.players[1]?.wallet_address.slice(0, 8)}...
            </Typography>
          </Box>
        </Box>
      )}

      {/* Game Board */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
        <CheckersBoard 
          gameId={gameId}
          currentPlayer={currentPlayer}
          isMultiplayer={true}
          playerColor={playerColor}
        />
      </Box>

      {/* Game Info */}
      <Box sx={{ textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Game ID: {gameId}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Entry Fee: {game.entry_fee} SOL
        </Typography>
      </Box>
    </Box>
  );
} 