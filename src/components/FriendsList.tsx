'use client';

import { FC, useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  IconButton,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  CircularProgress,
} from '@mui/material';
import { Delete as DeleteIcon, Add as AddIcon, ContactPhone as ContactPhoneIcon } from '@mui/icons-material';
import { useChatContext } from './ChatContext';

interface Friend {
  id: string;
  username: string;
  avatar_url: string;
  wallet_address: string;
  is_online: boolean;
  current_game?: string;
}

export const FriendsList: FC = () => {
  const { publicKey } = useWallet();
  const { openFindAllFriends } = useChatContext();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingFriend, setIsAddingFriend] = useState(false);
  const [newFriendAddress, setNewFriendAddress] = useState('');

  const fetchFriends = useCallback(async () => {
    if (!publicKey) return;

    try {
      const response = await fetch(`/api/friends?walletAddress=${publicKey.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setFriends(data);
      } else {
        console.error('Error fetching friends:', response.statusText);
      }
    } catch (error) {
      console.error('Error fetching friends:', error);
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    if (publicKey) {
      fetchFriends();
    }
  }, [publicKey, fetchFriends]);

  const addFriend = async () => {
    if (!publicKey || !newFriendAddress) return;

    try {
      const response = await fetch('/api/friends', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: publicKey.toString(),
          friendAddress: newFriendAddress,
        }),
      });

      if (response.ok) {
        await fetchFriends();
        setIsAddingFriend(false);
        setNewFriendAddress('');
      } else {
        console.error('Error adding friend:', response.statusText);
      }
    } catch (error) {
      console.error('Error adding friend:', error);
    }
  };

  const removeFriend = async (friendId: string) => {
    if (!publicKey) return;

    try {
      const response = await fetch(`/api/friends?walletAddress=${publicKey.toString()}&friendId=${friendId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchFriends();
      } else {
        console.error('Error removing friend:', response.statusText);
      }
    } catch (error) {
      console.error('Error removing friend:', error);
    }
  };

  if (!publicKey) {
    return (
      <Card sx={{ maxWidth: 600, mx: 'auto', mt: 4 }}>
        <CardContent>
          <Typography variant="h6" align="center">
            Please connect your wallet to view your friends
          </Typography>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Card sx={{ maxWidth: 600, mx: 'auto', mt: 4 }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Friends</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              startIcon={<ContactPhoneIcon />}
              variant="contained"
              onClick={openFindAllFriends}
              sx={{ 
                background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
                '&:hover': {
                  background: 'linear-gradient(45deg, #1976D2 30%, #0288D1 90%)',
                }
              }}
            >
              Find Friends
            </Button>
            <Button
              startIcon={<AddIcon />}
              variant="outlined"
              onClick={() => setIsAddingFriend(true)}
            >
              Add by Wallet
            </Button>
          </Box>
        </Box>

        {friends.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary" gutterBottom>
              No friends yet. Add some friends to start playing together!
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Use &quot;Find Friends&quot; to discover friends from your contacts, or &quot;Add by Wallet&quot; to add someone directly.
            </Typography>
          </Box>
        ) : (
          <List>
            {friends.map((friend) => (
              <ListItem
                key={friend.id}
                secondaryAction={
                  <IconButton
                    edge="end"
                    aria-label="delete"
                    onClick={() => removeFriend(friend.id)}
                  >
                    <DeleteIcon />
                  </IconButton>
                }
              >
                <ListItemAvatar>
                  <Avatar src={friend.avatar_url} />
                </ListItemAvatar>
                <ListItemText
                  primary={friend.username}
                  secondary={
                    <Box component="span" sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <Chip
                        size="small"
                        label={friend.is_online ? 'Online' : 'Offline'}
                        color={friend.is_online ? 'success' : 'default'}
                      />
                      {friend.current_game && (
                        <Chip
                          size="small"
                          label="In Game"
                          color="primary"
                        />
                      )}
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>

      <Dialog open={isAddingFriend} onClose={() => setIsAddingFriend(false)}>
        <DialogTitle>Add Friend by Wallet</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Friend's Wallet Address"
            fullWidth
            value={newFriendAddress}
            onChange={(e) => setNewFriendAddress(e.target.value)}
            placeholder="Enter Solana wallet address"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsAddingFriend(false)}>Cancel</Button>
          <Button onClick={addFriend} variant="contained">
            Add
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}; 