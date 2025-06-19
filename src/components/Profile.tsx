'use client';

import { FC, useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Avatar,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from '@mui/material';

interface ProfileData {
  username: string;
  avatar_url: string;
  games_played: number;
  games_won: number;
  total_winnings: number;
}

export const Profile: FC = () => {
  const { publicKey } = useWallet();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (publicKey) {
      fetchProfile();
    }
  }, [publicKey]);

  const fetchProfile = async () => {
    if (!publicKey) return;

    try {
      const response = await fetch(`/api/profile?walletAddress=${publicKey.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
      } else {
        console.error('Error fetching profile:', response.statusText);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateUsername = async () => {
    if (!publicKey || !newUsername) return;

    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: publicKey.toString(),
          username: newUsername,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (profile) {
          setProfile({
            ...profile,
            username: data.username,
          });
        }
        setIsEditing(false);
      } else {
        console.error('Error updating username:', response.statusText);
      }
    } catch (error) {
      console.error('Error updating username:', error);
    }
  };

  if (!publicKey) {
    return (
      <Card sx={{ maxWidth: 600, mx: 'auto', mt: 4 }}>
        <CardContent>
          <Typography variant="h6" align="center">
            Please connect your wallet to view your profile
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
        <Box display="flex" alignItems="center" mb={3}>
          <Avatar
            src={profile?.avatar_url}
            sx={{ width: 80, height: 80, mr: 2 }}
          />
          <Box>
            <Typography variant="h5" gutterBottom>
              {profile?.username}
            </Typography>
            <Button
              variant="outlined"
              size="small"
              onClick={() => {
                setNewUsername(profile?.username || '');
                setIsEditing(true);
              }}
            >
              Edit Username
            </Button>
          </Box>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Games Played
            </Typography>
            <Typography variant="h6">
              {profile?.games_played || 0}
            </Typography>
          </Box>
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Games Won
            </Typography>
            <Typography variant="h6">
              {profile?.games_won || 0}
            </Typography>
          </Box>
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Total Winnings
            </Typography>
            <Typography variant="h6">
              {profile?.total_winnings || 0} SOL
            </Typography>
          </Box>
        </Box>
      </CardContent>

      <Dialog open={isEditing} onClose={() => setIsEditing(false)}>
        <DialogTitle>Edit Username</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Username"
            fullWidth
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsEditing(false)}>Cancel</Button>
          <Button onClick={updateUsername} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}; 