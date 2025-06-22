'use client';

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Avatar,
  Chip,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  ContactPhone as ContactPhoneIcon,
  PersonAdd as PersonAddIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import { useWallet } from '@solana/wallet-adapter-react';

interface FoundUser {
  id: string;
  username: string;
  wallet_address: string;
  avatar_url?: string;
  phone_number: string;
  friendship_status: 'friend' | 'request_sent' | 'request_received' | 'not_friend';
  can_add_friend: boolean;
}

interface FindFriendsByPhoneProps {
  open: boolean;
  onClose: () => void;
}

export default function FindFriendsByPhone({ open, onClose }: FindFriendsByPhoneProps) {
  const { publicKey } = useWallet();
  const [phoneNumbers, setPhoneNumbers] = useState('');
  const [foundUsers, setFoundUsers] = useState<FoundUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [accessingContacts, setAccessingContacts] = useState(false);

  const handleAccessContacts = async () => {
    if (!publicKey) return;

    setAccessingContacts(true);
    try {
      // Check if the Contacts API is supported
      if ('contacts' in navigator && 'ContactsManager' in window) {
        // @ts-expect-error - Contacts API is experimental
        const contacts = await navigator.contacts.select(['tel'], { multiple: true });
        
        // Extract phone numbers from contacts
        const phoneNumberArray: string[] = [];
        contacts.forEach((contact: { tel?: string[] }) => {
          if (contact.tel) {
            contact.tel.forEach((phone: string) => {
              const cleanPhone = phone.replace(/[^\d+]/g, '');
              if (cleanPhone.length > 6) { // Basic validation
                phoneNumberArray.push(cleanPhone);
              }
            });
          }
        });

        if (phoneNumberArray.length > 0) {
          await searchWithPhoneNumbers(phoneNumberArray);
        } else {
          alert('No phone numbers found in your contacts');
        }
      } else {
        // Fallback: Show manual input method
        alert('Contacts access not supported on this device. Please use manual input below.');
      }
    } catch (error) {
      console.error('Error accessing contacts:', error);
      if (error instanceof Error && error.name === 'NotAllowedError') {
        alert('Contacts access denied. Please use manual input below or allow contacts access.');
      } else {
        alert('Unable to access contacts. Please use manual input below.');
      }
    } finally {
      setAccessingContacts(false);
    }
  };

  const searchWithPhoneNumbers = async (phoneNumberArray: string[]) => {
    if (!publicKey) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/friends/find-by-phone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: publicKey.toString(),
          phoneNumbers: phoneNumberArray,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setFoundUsers(data.found_users);
        setSearchPerformed(true);
      } else {
        console.error('Error searching for friends:', response.statusText);
      }
    } catch (error) {
      console.error('Error searching for friends:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleManualSearch = async () => {
    if (!publicKey || !phoneNumbers.trim()) return;

    // Parse phone numbers from input (split by newlines, commas, or spaces)
    const phoneNumberArray = phoneNumbers
      .split(/[\n,\s]+/)
      .map(num => num.trim())
      .filter(num => num.length > 0)
      .map(num => num.replace(/[^\d+]/g, '')); // Keep only digits and +

    await searchWithPhoneNumbers(phoneNumberArray);
  };

  const handleAddFriend = async (friendId: string) => {
    if (!publicKey) return;

    try {
      const friendUser = foundUsers.find(u => u.id === friendId);
      const response = await fetch('/api/friends', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: publicKey.toString(),
          friendWalletAddress: friendUser?.wallet_address,
        }),
      });

      if (response.ok) {
        // Update the user's status locally
        setFoundUsers(prev => prev.map(user => 
          user.id === friendId 
            ? { ...user, friendship_status: 'request_sent', can_add_friend: false }
            : user
        ));
      }
    } catch (error) {
      console.error('Error adding friend:', error);
    }
  };

  const handleClose = () => {
    setFoundUsers([]);
    setPhoneNumbers('');
    setSearchPerformed(false);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <ContactPhoneIcon />
          <Typography variant="h6">Find Friends</Typography>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Find friends who are already using Crypto Boards. Your contacts are not stored - we only check for matches.
          </Typography>
          
          {/* Auto Access Contacts Button */}
          <Button
            variant="contained"
            size="large"
            onClick={handleAccessContacts}
            disabled={accessingContacts || loading}
            sx={{ mt: 2, mb: 2 }}
            fullWidth
          >
            {accessingContacts ? (
              <>
                <CircularProgress size={20} sx={{ mr: 1 }} />
                Accessing Contacts...
              </>
            ) : (
              '🔍 Find All Friends (Access Contacts)'
            )}
          </Button>

          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', my: 2 }}>
            — or manually enter phone numbers —
          </Typography>
          
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Phone Numbers (Manual)"
            placeholder="+1 555-123-4567&#10;+1 555-987-6543&#10;..."
            value={phoneNumbers}
            onChange={(e) => setPhoneNumbers(e.target.value)}
            helperText="Enter one phone number per line. Include country codes for best results."
          />
          
          <Button
            variant="outlined"
            onClick={handleManualSearch}
            disabled={!phoneNumbers.trim() || loading}
            sx={{ mt: 2 }}
            fullWidth
          >
            {loading ? <CircularProgress size={24} /> : 'Search Manual Numbers'}
          </Button>
        </Box>

        {searchPerformed && (
          <Box>
            {foundUsers.length > 0 ? (
              <>
                <Typography variant="h6" gutterBottom>
                  Found {foundUsers.length} friend{foundUsers.length !== 1 ? 's' : ''} 🎉
                </Typography>
                <List>
                  {foundUsers.map((user) => (
                    <ListItem key={user.id} divider>
                      <ListItemAvatar>
                        <Avatar src={user.avatar_url}>
                          {user.username.charAt(0)}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={user.username}
                        secondary={`${user.phone_number} • ${user.wallet_address.slice(0, 8)}...`}
                      />
                      <ListItemSecondaryAction>
                        {user.friendship_status === 'friend' && (
                          <Chip 
                            label="Already Friends" 
                            color="success" 
                            size="small"
                            icon={<CheckIcon />}
                          />
                        )}
                        {user.friendship_status === 'request_sent' && (
                          <Chip 
                            label="Request Sent" 
                            color="info" 
                            size="small"
                          />
                        )}
                        {user.friendship_status === 'request_received' && (
                          <Chip 
                            label="Pending Response" 
                            color="warning" 
                            size="small"
                          />
                        )}
                        {user.can_add_friend && (
                          <Button
                            size="small"
                            variant="contained"
                            startIcon={<PersonAddIcon />}
                            onClick={() => handleAddFriend(user.id)}
                          >
                            Add Friend
                          </Button>
                        )}
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              </>
            ) : (
              <Alert severity="info">
                No friends found in your contacts. Invite them to join Crypto Boards!
              </Alert>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
} 