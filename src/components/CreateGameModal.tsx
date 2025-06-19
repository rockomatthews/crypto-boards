'use client';

import { FC, useState, useEffect } from 'react';
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
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useWallet } from '@solana/wallet-adapter-react';

interface Game {
  id: number;
  title: string;
  description: string;
  image: string;
  minPlayers: number;
  maxPlayers: number;
  route: string;
}

interface CreateGameModalProps {
  open: boolean;
  onClose: () => void;
  game: Game | null;
}

export const CreateGameModal: FC<CreateGameModalProps> = ({
  open,
  onClose,
  game,
}) => {
  const { publicKey } = useWallet();
  const router = useRouter();
  const [entryFee, setEntryFee] = useState('');
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [friends, setFriends] = useState<Array<{ id: string; username: string; wallet_address: string }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && publicKey) {
      fetchFriends();
    }
  }, [open, publicKey]);

  const fetchFriends = async () => {
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
  };

  const handleCreateLobby = async () => {
    if (!publicKey || !game || !entryFee) return;

    setLoading(true);
    try {
      const response = await fetch('/api/lobbies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gameType: game.title.toLowerCase(),
          entryFee: parseFloat(entryFee),
          creatorWalletAddress: publicKey.toString(),
          invitedPlayers: selectedFriends,
          maxPlayers: game.maxPlayers,
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
            Create {game?.title} Lobby
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent>
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

        <Box sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Game Summary
          </Typography>
          <Typography variant="body2">
            • Game: {game?.title}
          </Typography>
          <Typography variant="body2">
            • Entry Fee: {entryFee || '0'} SOL
          </Typography>
          <Typography variant="body2">
            • Players: {selectedFriends.length + 1}/{game?.maxPlayers}
          </Typography>
          <Typography variant="body2">
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