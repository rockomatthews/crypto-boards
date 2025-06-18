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
import { db } from '../lib/db/schema';

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
      const result = await db`
        SELECT 
          p.username,
          p.avatar_url,
          COUNT(DISTINCT gp.game_id) as games_played,
          COUNT(DISTINCT CASE WHEN gp.is_winner = true THEN gp.game_id END) as games_won,
          COALESCE(SUM(CASE WHEN gp.is_winner = true THEN g.entry_fee * g.max_players ELSE 0 END), 0) as total_winnings
        FROM players p
        LEFT JOIN game_players gp ON p.id = gp.player_id
        LEFT JOIN games g ON gp.game_id = g.id
        WHERE p.wallet_address = ${publicKey.toString()}
        GROUP BY p.id, p.username, p.avatar_url
      `;

      if (result.length > 0) {
        const profileData: ProfileData = {
          username: result[0].username,
          avatar_url: result[0].avatar_url,
          games_played: Number(result[0].games_played),
          games_won: Number(result[0].games_won),
          total_winnings: Number(result[0].total_winnings),
        };
        setProfile(profileData);
      } else {
        // Create new profile if it doesn't exist
        await createProfile();
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const createProfile = async () => {
    if (!publicKey) return;

    try {
      const result = await db`
        INSERT INTO players (wallet_address, username, avatar_url)
        VALUES (${publicKey.toString()}, ${`Player${publicKey.toString().slice(0, 4)}`}, '')
        RETURNING username, avatar_url
      `;

      if (result.length > 0) {
        const newProfile: ProfileData = {
          username: result[0].username,
          avatar_url: result[0].avatar_url,
          games_played: 0,
          games_won: 0,
          total_winnings: 0,
        };
        setProfile(newProfile);
      }
    } catch (error) {
      console.error('Error creating profile:', error);
    }
  };

  const updateUsername = async () => {
    if (!publicKey || !newUsername) return;

    try {
      const result = await db`
        UPDATE players
        SET username = ${newUsername}
        WHERE wallet_address = ${publicKey.toString()}
        RETURNING username
      `;

      if (result.length > 0 && profile) {
        setProfile({
          ...profile,
          username: result[0].username,
        });
        setIsEditing(false);
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