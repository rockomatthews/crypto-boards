'use client';

import { FC, useState, useEffect } from 'react';
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
import { Delete as DeleteIcon, Add as AddIcon } from '@mui/icons-material';
import { db } from '../lib/db/schema';

interface FriendRow {
  id: string;
  username: string;
  avatar_url: string;
  wallet_address: string;
  is_online: boolean;
  current_game: string | null;
}

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
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingFriend, setIsAddingFriend] = useState(false);
  const [newFriendAddress, setNewFriendAddress] = useState('');

  useEffect(() => {
    if (publicKey) {
      fetchFriends();
    }
  }, [publicKey]);

  const fetchFriends = async () => {
    if (!publicKey) return;

    try {
      const result = (await db`
        SELECT 
          p.id,
          p.username,
          p.avatar_url,
          p.wallet_address,
          p.is_online,
          g.id as current_game
        FROM friendships f
        JOIN players p ON f.friend_id = p.id
        LEFT JOIN game_players gp ON p.id = gp.player_id AND gp.game_status = 'active'
        LEFT JOIN games g ON gp.game_id = g.id
        WHERE f.player_id = (
          SELECT id FROM players WHERE wallet_address = ${publicKey.toString()}
        )
        ORDER BY p.is_online DESC, p.username ASC
      `) as FriendRow[];

      setFriends(result.map((row) => ({
        id: row.id,
        username: row.username,
        avatar_url: row.avatar_url,
        wallet_address: row.wallet_address,
        is_online: row.is_online,
        current_game: row.current_game || undefined,
      })));
    } catch (error) {
      console.error('Error fetching friends:', error);
    } finally {
      setLoading(false);
    }
  };

  const addFriend = async () => {
    if (!publicKey || !newFriendAddress) return;

    try {
      // First, ensure the friend exists in the players table
      const friendResult = await db`
        INSERT INTO players (wallet_address, username, avatar_url)
        VALUES (${newFriendAddress}, ${`Player${newFriendAddress.slice(0, 4)}`}, '')
        ON CONFLICT (wallet_address) DO NOTHING
        RETURNING id
      `;

      if (friendResult.length > 0) {
        // Add the friendship
        await db`
          INSERT INTO friendships (player_id, friend_id)
          SELECT 
            (SELECT id FROM players WHERE wallet_address = ${publicKey.toString()}),
            ${friendResult[0].id}
          ON CONFLICT (player_id, friend_id) DO NOTHING
        `;

        await fetchFriends();
        setIsAddingFriend(false);
        setNewFriendAddress('');
      }
    } catch (error) {
      console.error('Error adding friend:', error);
    }
  };

  const removeFriend = async (friendId: string) => {
    if (!publicKey) return;

    try {
      await db`
        DELETE FROM friendships
        WHERE player_id = (SELECT id FROM players WHERE wallet_address = ${publicKey.toString()})
        AND friend_id = ${friendId}
      `;

      await fetchFriends();
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
          <Button
            startIcon={<AddIcon />}
            variant="contained"
            onClick={() => setIsAddingFriend(true)}
          >
            Add Friend
          </Button>
        </Box>

        {friends.length === 0 ? (
          <Typography color="text.secondary" align="center">
            No friends yet. Add some friends to start playing together!
          </Typography>
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
        <DialogTitle>Add Friend</DialogTitle>
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