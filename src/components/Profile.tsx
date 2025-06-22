'use client';

import { FC, useState, useEffect, useRef, useCallback } from 'react';
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
  Fab,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon } from '@mui/icons-material';
import PhoneInput from './PhoneInput';

interface ProfileData {
  username: string;
  avatar_url: string;
  phone_number?: string;
  games_played: number;
  games_won: number;
  total_winnings: number;
}

export const Profile: FC = () => {
  const { publicKey } = useWallet();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPhoneNumber, setNewPhoneNumber] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchProfile = useCallback(async () => {
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
  }, [publicKey]);

  useEffect(() => {
    if (publicKey) {
      fetchProfile();
    }
  }, [publicKey, fetchProfile]);

  const updateProfile = async () => {
    if (!publicKey) return;

    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: publicKey.toString(),
          username: newUsername || undefined,
          phoneNumber: newPhoneNumber || undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (profile) {
          setProfile({
            ...profile,
            username: data.username,
            phone_number: data.phone_number,
          });
        }
        setIsEditing(false);
      } else {
        console.error('Error updating profile:', response.statusText);
      }
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !publicKey) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB');
      return;
    }

    setUploadingImage(true);

    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('walletAddress', publicKey.toString());

      const response = await fetch('/api/profile/avatar', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        if (profile) {
          setProfile({
            ...profile,
            avatar_url: data.avatar_url,
          });
        }
      } else {
        console.error('Error uploading image:', response.statusText);
        alert('Failed to upload image');
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
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
          <Box position="relative">
            <Avatar
              src={profile?.avatar_url}
              sx={{ 
                width: 80, 
                height: 80, 
                mr: 2,
                bgcolor: profile?.avatar_url ? 'transparent' : 'grey.300'
              }}
            >
              {!profile?.avatar_url && <AddIcon />}
            </Avatar>
            <Fab
              size="small"
              color="primary"
              sx={{
                position: 'absolute',
                bottom: 0,
                right: 16,
                width: 32,
                height: 32,
                minHeight: 32,
              }}
              onClick={triggerFileUpload}
              disabled={uploadingImage}
            >
              {uploadingImage ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <EditIcon sx={{ fontSize: 16 }} />
              )}
            </Fab>
          </Box>
          <Box>
            <Typography variant="h5" gutterBottom>
              {profile?.username}
            </Typography>
            <Button
              variant="outlined"
              size="small"
              onClick={() => {
                setNewUsername(profile?.username || '');
                setNewPhoneNumber(profile?.phone_number || '');
                setIsEditing(true);
              }}
            >
              Edit Profile
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

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleImageUpload}
      />

      <Dialog open={isEditing} onClose={() => setIsEditing(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Profile</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField
            autoFocus
            margin="dense"
            label="Username"
            fullWidth
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            sx={{ mb: 3 }}
          />
          <PhoneInput
            value={newPhoneNumber}
            onChange={(value) => setNewPhoneNumber(value || '')}
            label="Phone Number (Private)"
            placeholder="Select country and enter number"
            helperText="Your phone number is private and only used to help friends find you"
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsEditing(false)}>Cancel</Button>
          <Button onClick={updateProfile} variant="contained">
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}; 