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
  Tabs,
  Tab,
  Snackbar,
  Alert,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Close as CloseIcon, Sms as SmsIcon, People as PeopleIcon } from '@mui/icons-material';
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
    title: 'Stratego',
    description: 'Deploy your army and capture the enemy flag in this classic strategy battle!',
    image: '/images/stratego.png',
    minPlayers: 2,
    maxPlayers: 2,
    route: '/stratego'
  },
  {
    id: 4,
    title: 'Battleship',
    description: 'Naval strategy game! Deploy your fleet and sink your opponent to claim victory!',
    image: '/images/battleship.png',
    minPlayers: 2,
    maxPlayers: 2,
    route: '/battleship'
  }
];

export const CreateGameModal: FC<CreateGameModalProps> = ({
  open,
  onClose,
}) => {
  const { publicKey } = useWallet();
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [entryFee, setEntryFee] = useState('');
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [friends, setFriends] = useState<Array<{ id: string; username: string; wallet_address: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [selectedGameId, setSelectedGameId] = useState<number>(GAME_OPTIONS[0].id);
  const selectedGame = GAME_OPTIONS.find(g => g.id === selectedGameId)!;
  
  // SMS invitation state
  const [inviteTab, setInviteTab] = useState(0); // 0 = Friends, 1 = SMS
  const [phoneNumbers, setPhoneNumbers] = useState<string[]>(['']);
  const [smsLoading, setSmsLoading] = useState(false);
  const [smsMessage, setSmsMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
        
        // Send SMS invitations if any phone numbers are provided
        const validPhoneNumbers = phoneNumbers.filter(num => num.trim().length >= 10);
        if (validPhoneNumbers.length > 0) {
          await sendSMSInvitations(lobby.id);
        }
        
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

  const handlePhoneNumberChange = (index: number, value: string) => {
    setPhoneNumbers(prev => {
      const newNumbers = [...prev];
      newNumbers[index] = value;
      return newNumbers;
    });
  };

  const addPhoneNumberField = () => {
    setPhoneNumbers(prev => [...prev, '']);
  };

  const removePhoneNumberField = (index: number) => {
    setPhoneNumbers(prev => prev.filter((_, i) => i !== index));
  };

  const sendSMSInvitations = async (lobbyId: string) => {
    const validPhoneNumbers = phoneNumbers.filter(num => num.trim().length >= 10);
    if (validPhoneNumbers.length === 0) return;

    setSmsLoading(true);
    try {
      const response = await fetch('/api/sms/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderWalletAddress: publicKey?.toString(),
          phoneNumbers: validPhoneNumbers,
          gameType: selectedGame.title.toLowerCase(),
          entryFee: parseFloat(entryFee),
          lobbyId
        })
      });

      const result = await response.json();
      if (response.ok) {
        setSmsMessage({ 
          type: 'success', 
          text: result.message 
        });
      } else {
        // Handle specific error cases
        if (response.status === 503) {
          setSmsMessage({ 
            type: 'error', 
            text: '📱 SMS service is not configured yet. Game lobby created successfully! Share the lobby link manually for now.' 
          });
        } else {
          setSmsMessage({ 
            type: 'error', 
            text: result.error || 'Failed to send SMS invitations' 
          });
        }
      }
    } catch (error) {
      console.error('Error sending SMS:', error);
      setSmsMessage({ 
        type: 'error', 
        text: 'Failed to send SMS invitations' 
      });
    } finally {
      setSmsLoading(false);
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth
      fullScreen={isMobile}
      sx={{
        '& .MuiDialog-paper': {
          minHeight: isMobile ? '100vh' : 'auto',
          margin: isMobile ? 0 : '32px',
        }
      }}
    >
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
            Invite Players (Optional)
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Invite friends or send SMS invitations. Leave empty for a public lobby.
          </Typography>
          
          <Tabs value={inviteTab} onChange={(_, newValue) => setInviteTab(newValue)} sx={{ mb: 2 }}>
            <Tab icon={<PeopleIcon />} label="Friends" />
            <Tab icon={<SmsIcon />} label="SMS Invites" />
          </Tabs>

          {inviteTab === 0 ? (
            // Friends Tab
            friends.length > 0 ? (
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
                No friends found. Add friends to invite them to games.
              </Typography>
            )
          ) : (
            // SMS Tab
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                📱 Enter phone numbers to send SMS invitations:
              </Typography>
              <Typography variant="caption" color="text.secondary" gutterBottom display="block" sx={{ mb: 2 }}>
                💡 Note: Recipients will receive a text message with a link to join your game lobby
              </Typography>
              {phoneNumbers.map((phoneNumber, index) => (
                <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1 }}>
                  <TextField
                    fullWidth
                    size="small"
                    label={`Phone Number ${index + 1}`}
                    value={phoneNumber}
                    onChange={(e) => handlePhoneNumberChange(index, e.target.value)}
                    placeholder="+1 (555) 123-4567"
                    inputProps={{ 
                      type: 'tel',
                      pattern: '[0-9+()-\\s]*'
                    }}
                  />
                  {phoneNumbers.length > 1 && (
                    <IconButton 
                      onClick={() => removePhoneNumberField(index)}
                      size="small"
                      color="error"
                    >
                      <CloseIcon />
                    </IconButton>
                  )}
                </Box>
              ))}
              <Button 
                onClick={addPhoneNumberField} 
                size="small" 
                variant="outlined"
                sx={{ mt: 1 }}
              >
                + Add Phone Number
              </Button>
            </Box>
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
            • Friends Invited: {selectedFriends.length}
          </Typography>
          <Typography variant="body2" sx={{ color: 'grey.300' }}>
            • SMS Invites: {phoneNumbers.filter(num => num.trim().length >= 10).length}
          </Typography>
          <Typography variant="body2" sx={{ color: 'grey.300' }}>
            • Type: {selectedFriends.length > 0 || phoneNumbers.some(num => num.trim().length >= 10) ? 'Private' : 'Public'}
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ 
        p: 2, 
        gap: 2,
        flexDirection: isMobile ? 'column' : 'row',
        '& > *': {
          minHeight: '48px',
        }
      }}>
        <Button 
          onClick={onClose}
          sx={{ 
            minWidth: isMobile ? '100%' : 'auto',
            py: 1.5,
          }}
        >
          Cancel
        </Button>
        <Button 
          onClick={handleCreateLobby}
          variant="contained"
          disabled={!entryFee || loading || smsLoading}
          sx={{ 
            minWidth: isMobile ? '100%' : 'auto',
            py: 1.5,
            '&:active': {
              transform: 'scale(0.98)',
            },
            '&:focus': {
              outline: '2px solid #00e676',
              outlineOffset: '2px',
            }
          }}
        >
          {loading ? 'Creating...' : smsLoading ? 'Sending SMS...' : 'Create Lobby'}
        </Button>
      </DialogActions>

      {/* SMS Status Snackbar */}
      <Snackbar
        open={!!smsMessage}
        autoHideDuration={6000}
        onClose={() => setSmsMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSmsMessage(null)} 
          severity={smsMessage?.type || 'info'}
          sx={{ width: '100%' }}
        >
          {smsMessage?.text}
        </Alert>
      </Snackbar>
    </Dialog>
  );
}; 