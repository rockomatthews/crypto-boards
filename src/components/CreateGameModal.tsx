'use client';

import { FC, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useWallet } from '@solana/wallet-adapter-react';

interface CreateGameModalProps {
  open: boolean;
  onClose: () => void;
}

const GAME_OPTIONS = [
  {
    id: 1,
    title: 'Checkers',
    description: 'Classic strategy game with a crypto twist. Play and earn!',
    image: '/images/checkers.jpg',
    minPlayers: 2,
    maxPlayers: 2,
    route: '/checkers'
  },
  {
    id: 2,
    title: 'Chess',
    description: 'The ultimate battle of wits. Stake your SOL and prove your mastery.',
    image: '/images/chess.jpg',
    minPlayers: 2,
    maxPlayers: 2,
    route: '/chess'
  },
  {
    id: 3,
    title: 'Go',
    description: 'Ancient strategy game meets modern crypto gaming.',
    image: '/images/go.jpg',
    minPlayers: 2,
    maxPlayers: 2,
    route: '/go'
  },
  {
    id: 4,
    title: 'Poker',
    description: 'Texas Hold\'em with crypto stakes. Play with friends or join public tables.',
    image: '/images/poker.jpg',
    minPlayers: 2,
    maxPlayers: 6,
    route: '/poker'
  }
];

export const CreateGameModal: FC<CreateGameModalProps> = ({
  open,
  onClose,
}) => {
  const { publicKey } = useWallet();
  const router = useRouter();
  const [entryFee, setEntryFee] = useState('');
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [friends, setFriends] = useState<Array<{ id: string; username: string; wallet_address: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [selectedGameId, setSelectedGameId] = useState<number>(GAME_OPTIONS[0].id);
  const selectedGame = GAME_OPTIONS.find(g => g.id === selectedGameId)!;

  const fetchFriends = useCallback(async () => {
    if (!publicKey) return;

    try {
      const response = await fetch(`/api/friends?walletAddress=${publicKey.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setFriends(data);
      }
    } catch (error) {
      console.error('Error fetching friends:', error);
    }
  }, [publicKey]);

  useEffect(() => {
    if (open && publicKey) {
      fetchFriends();
    }
  }, [open, publicKey, fetchFriends]);

  const handleCreateLobby = async () => {
    if (!publicKey || !selectedGame || !entryFee) return;
    setLoading(true);
    try {
      const response = await fetch('/api/lobbies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gameType: selectedGame.title.toLowerCase(),
          entryFee: parseFloat(entryFee),
          creatorWalletAddress: publicKey.toString(),
          invitedPlayers: selectedFriends,
          maxPlayers: selectedGame.maxPlayers,
        }),
      });

      if (response.ok) {
        const lobby = await response.json();
        onClose();
        // Navigate to the created lobby
        router.push(`/lobby/${lobby.id}`);
      } else {
        console.error('Failed to create lobby');
      }
    } catch (error) {
      console.error('Error creating lobby:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFriendToggle = (friendId: string) => {
    setSelectedFriends(prev => 
      prev.includes(friendId) 
        ? prev.filter(id => id !== friendId)
        : [...prev, friendId]
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">
            Create Game Lobby
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <FormControl fullWidth sx={{ mb: 3 }}>
          <InputLabel id="game-type-label">Game Type</InputLabel>
          <Select
            labelId="game-type-label"
            value={selectedGameId}
            label="Game Type"
            onChange={e => setSelectedGameId(Number(e.target.value))}
          >
            {GAME_OPTIONS.map(game => (
              <MenuItem key={game.id} value={game.id}>{game.title}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Set the entry fee for this game. All players must pay this amount to join.
          </Typography>
          <TextField
            fullWidth
            label="Entry Fee (SOL)"
            type="number"
            value={entryFee}
            onChange={(e) => setEntryFee(e.target.value)}
            inputProps={{ min: 0.01, step: 0.01 }}
            sx={{ mt: 1 }}
          />
        </Box>

        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Invite Friends (Optional)
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Select friends to invite to this private game. Leave empty for a public lobby.
          </Typography>
          
          {friends.length > 0 ? (
            <List dense>
              {friends.map((friend) => (
                <ListItem key={friend.id} onClick={() => handleFriendToggle(friend.id)}>
                  <ListItemAvatar>
                    <Avatar>{friend.username.charAt(0)}</Avatar>
                  </ListItemAvatar>
                  <ListItemText 
                    primary={friend.username}
                    secondary={friend.wallet_address.slice(0, 8) + '...'}
                  />
                  <ListItemSecondaryAction>
                    <Chip 
                      label={selectedFriends.includes(friend.id) ? "Invited" : "Invite"}
                      color={selectedFriends.includes(friend.id) ? "primary" : "default"}
                      size="small"
                    />
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No friends found. This will be a public lobby.
            </Typography>
          )}
        </Box>

        <Box sx={{ p: 2, bgcolor: 'grey.800', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom sx={{ color: 'white', fontWeight: 'bold' }}>
            Game Summary
          </Typography>
          <Typography variant="body2" sx={{ color: 'grey.300' }}>
            • Game: {selectedGame.title}
          </Typography>
          <Typography variant="body2" sx={{ color: 'grey.300' }}>
            • Entry Fee: {entryFee || '0'} SOL
          </Typography>
          <Typography variant="body2" sx={{ color: 'grey.300' }}>
            • Players: {selectedFriends.length + 1}/{selectedGame.maxPlayers}
          </Typography>
          <Typography variant="body2" sx={{ color: 'grey.300' }}>
            • Type: {selectedFriends.length > 0 ? 'Private' : 'Public'}
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleCreateLobby}
          variant="contained"
          disabled={!entryFee || loading}
        >
          {loading ? 'Creating...' : 'Create Lobby'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}; 