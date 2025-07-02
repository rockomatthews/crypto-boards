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
  FormControlLabel,
  Switch,
  Alert,
  Divider,
  Paper,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Sms as SmsIcon } from '@mui/icons-material';
import PhoneInput from './PhoneInput';
import { StatsModal } from './StatsModal';

interface ProfileData {
  username: string;
  avatar_url: string;
  phone_number?: string;
  sms_notifications_enabled: boolean;
  sms_opted_in_at?: string;
  games_played: number;
  games_won: number;
  total_winnings: number;
}

export const Profile: FC = () => {
  const { publicKey } = useWallet();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPhoneNumber, setNewPhoneNumber] = useState<string>('');
  const [smsNotificationsEnabled, setSmsNotificationsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showSmsDialog, setShowSmsDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchProfile = useCallback(async () => {
    if (!publicKey) return;

    try {
      const response = await fetch(`/api/profile?walletAddress=${publicKey.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
        setSmsNotificationsEnabled(data.sms_notifications_enabled || false);
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
        console.log('✅ Profile updated successfully:', data);
        
        await fetchProfile();
        setIsEditing(false);
      } else {
        console.error('Error updating profile:', response.statusText);
      }
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };

  const updateSmsPreferences = async (enabled: boolean) => {
    if (!publicKey) return;

    try {
      const response = await fetch('/api/profile/sms-preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: publicKey.toString(),
          smsNotificationsEnabled: enabled,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ SMS preferences updated:', data);
        
        await fetchProfile();
        setSmsNotificationsEnabled(enabled);
        if (enabled) {
          setShowSmsDialog(false);
        }
      } else {
        console.error('Error updating SMS preferences:', response.statusText);
      }
    } catch (error) {
      console.error('Error updating SMS preferences:', error);
    }
  };

  const handleSmsToggle = (enabled: boolean) => {
    if (enabled && (!profile?.phone_number)) {
      // Show dialog to enter phone number first
      setShowSmsDialog(true);
      return;
    }
    updateSmsPreferences(enabled);
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !publicKey) return;

    setUploadingImage(true);
    const formData = new FormData();
    formData.append('avatar', file);
    formData.append('walletAddress', publicKey.toString());

    try {
      const response = await fetch('/api/profile/avatar', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Avatar updated successfully:', data);
        
        await fetchProfile();
      } else {
        console.error('Error uploading avatar:', response.statusText);
      }
    } catch (error) {
      console.error('Error uploading avatar:', error);
    } finally {
      setUploadingImage(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!publicKey) {
    return (
      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          Connect your wallet to view your profile
        </Typography>
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
            <Box sx={{ display: 'flex', gap: 1 }}>
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
              <Button
                variant="contained"
                size="small"
                onClick={() => setShowStats(true)}
                sx={{ 
                  bgcolor: '#8B4513', 
                  '&:hover': { bgcolor: '#654321' } 
                }}
              >
                📊 Stats
              </Button>
            </Box>
          </Box>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, mb: 3 }}>
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

        <Divider sx={{ my: 3 }} />

        {/* SMS Notifications Section */}
        <Paper sx={{ p: 2, bgcolor: '#2d2d2d', color: 'white' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <SmsIcon sx={{ mr: 1, color: 'white' }} />
            <Typography variant="h6" sx={{ color: 'white' }}>
              Text Notifications
            </Typography>
          </Box>
          
          <Typography variant="body2" sx={{ color: '#ccc' }} gutterBottom>
            Get notified about game invitations, game starts, and important updates.
          </Typography>

          {profile?.phone_number ? (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" sx={{ mb: 1 }}>
                Phone: {profile.phone_number}
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={smsNotificationsEnabled}
                    onChange={(e) => handleSmsToggle(e.target.checked)}
                    color="primary"
                  />
                }
                label={smsNotificationsEnabled ? "Notifications ON" : "Notifications OFF"}
              />
              {profile.sms_opted_in_at && (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                  Enabled on {new Date(profile.sms_opted_in_at).toLocaleDateString()}
                </Typography>
              )}
            </Box>
          ) : (
            <Alert severity="info" sx={{ mt: 2 }}>
              Add a phone number to enable text notifications.
              <Button
                size="small"
                variant="outlined"
                sx={{ ml: 2 }}
                onClick={() => setShowSmsDialog(true)}
              >
                Add Phone Number
              </Button>
            </Alert>
          )}
        </Paper>
      </CardContent>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleImageUpload}
      />

      {/* Edit Profile Dialog */}
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
            onChange={(value) => {
              console.log('PhoneInput onChange:', value);
              setNewPhoneNumber(value || '');
            }}
            label="Phone Number (Private)"
            placeholder="Select country and enter number"
            helperText="Your phone number is private and only used for notifications and finding friends"
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

      {/* SMS Setup Dialog */}
      <Dialog open={showSmsDialog} onClose={() => setShowSmsDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Enable Text Notifications</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="body1" gutterBottom>
            To receive text notifications about game invitations and updates, please enter your phone number.
          </Typography>
          
          <PhoneInput
            value={newPhoneNumber}
            onChange={(value) => setNewPhoneNumber(value || '')}
            label="Phone Number"
            placeholder="Select country and enter number"
            helperText="Standard messaging rates may apply"
            fullWidth
          />

          <Alert severity="info" sx={{ mt: 2 }}>
                         <strong>What you&apos;ll receive:</strong>
             <br />• Game invitations from friends
             <br />• Game start notifications
             <br />• Game completion updates
             <br />• Reply STOP to opt out anytime
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSmsDialog(false)}>Cancel</Button>
          <Button 
            onClick={async () => {
              if (newPhoneNumber) {
                // First update phone number
                await updateProfile();
                // Then enable SMS notifications
                await updateSmsPreferences(true);
              }
            }} 
            variant="contained"
            disabled={!newPhoneNumber}
          >
            Enable Notifications
          </Button>
        </DialogActions>
      </Dialog>

      <StatsModal open={showStats} onClose={() => setShowStats(false)} />
    </Card>
  );
}; 