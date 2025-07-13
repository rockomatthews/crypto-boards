'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  TextField,
  List,
  ListItemAvatar,
  ListItemText,
  Avatar,
  IconButton,
  InputAdornment,
  Dialog,
  DialogContent,
  Chip,
  ListItemButton,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Send as SendIcon,
  Close as CloseIcon,
  Lock as LockIcon,
  Public as PublicIcon,
  Group as GroupIcon,
} from '@mui/icons-material';
import { useWallet } from '@solana/wallet-adapter-react';

interface ChatMessage {
  id: string;
  sender_id: string;
  sender_username: string;
  sender_avatar?: string;
  content: string;
  message_type: 'text' | 'game_invite' | 'friend_request';
  created_at: string;
  is_global: boolean;
  recipient_id?: string;
  room_id?: string;
}

interface ChatRoom {
  id: string;
  name: string;
  type: 'private' | 'global';
  participants?: string[];
}

interface GameChatModalProps {
  isVisible: boolean;
  onClose: () => void;
  gameId?: string;
  gamePlayers?: { id: string; username: string; wallet_address: string }[];
}

export default function GameChatModal({ 
  isVisible, 
  onClose,
  gameId,
  gamePlayers: propGamePlayers = []
}: GameChatModalProps) {
  const { publicKey } = useWallet();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [selectedRoom, setSelectedRoom] = useState<string>('private');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [gamePlayers, setGamePlayers] = useState(propGamePlayers);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Define available chat rooms
  const chatRooms: ChatRoom[] = [
    {
      id: 'private',
      name: 'Game Room',
      type: 'private',
      participants: gamePlayers.map(p => p.wallet_address)
    },
    {
      id: 'global',
      name: 'Global Chat',
      type: 'global'
    }
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchGamePlayers = useCallback(async () => {
    if (!gameId || gamePlayers.length > 0) return;

    try {
      const response = await fetch(`/api/games/${gameId}`);
      if (response.ok) {
        const gameData = await response.json();
        // Assuming the API returns players array
        if (gameData.players) {
          setGamePlayers(gameData.players);
        }
      }
    } catch (error) {
      console.error('Error fetching game players:', error);
    }
  }, [gameId, gamePlayers.length]);

  const fetchMessages = useCallback(async () => {
    if (!publicKey) return;
    
    try {
      const isPrivateRoom = selectedRoom === 'private';
      const url = isPrivateRoom && gameId 
        ? `/api/chat/messages?walletAddress=${publicKey.toString()}&gameId=${gameId}&private=true`
        : `/api/chat/messages?walletAddress=${publicKey.toString()}`;
        
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  }, [publicKey, selectedRoom, gameId]);

  useEffect(() => {
    if (isVisible && publicKey) {
      fetchGamePlayers();
      fetchMessages();
      
      // Poll for updates every 2 seconds when chat is open
      const interval = setInterval(fetchMessages, 2000);
      
      return () => clearInterval(interval);
    }
  }, [isVisible, publicKey, fetchGamePlayers, fetchMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!publicKey || !newMessage.trim()) return;

    setLoading(true);
    try {
      const isPrivateRoom = selectedRoom === 'private';
      const response = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: publicKey.toString(),
          content: newMessage.trim(),
          messageType: 'text',
          isGlobal: !isPrivateRoom,
          gameId: isPrivateRoom ? gameId : undefined,
          recipientIds: isPrivateRoom ? gamePlayers.map(p => p.wallet_address) : undefined,
        }),
      });

      if (response.ok) {
        setNewMessage('');
        fetchMessages();
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentRoom = () => chatRooms.find(room => room.id === selectedRoom);
  const currentRoom = getCurrentRoom();

  if (!isVisible) return null;

  return (
    <Dialog 
      open={isVisible} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        sx: {
          height: { xs: '100vh', md: '80vh' },
          maxHeight: { xs: '100vh', md: '600px' },
          m: { xs: 0, md: 2 }
        }
      }}
    >
      <DialogContent sx={{ p: 0, display: 'flex', height: '100%', flexDirection: { xs: 'column', md: 'row' } }}>
        {/* Mobile Room Selector */}
        <Box sx={{ 
          display: { xs: 'flex', md: 'none' },
          p: 1,
          borderBottom: '1px solid #e0e0e0',
          gap: 1,
          alignItems: 'center',
          bgcolor: 'grey.50'
        }}>
          {chatRooms.map((room) => (
            <Chip
              key={room.id}
              label={room.name}
              variant={selectedRoom === room.id ? "filled" : "outlined"}
              color={selectedRoom === room.id ? "primary" : "default"}
              onClick={() => setSelectedRoom(room.id)}
              icon={room.type === 'private' ? <LockIcon /> : <PublicIcon />}
              size="small"
              sx={{ fontSize: '0.75rem' }}
            />
          ))}
        </Box>

        {/* Desktop Left Sidebar - Room Selection */}
        <Box sx={{ 
          width: { md: 200 }, 
          borderRight: { md: '1px solid #e0e0e0' },
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column'
        }}>
          <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0' }}>
            <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 'bold' }}>
              Chat Rooms
            </Typography>
          </Box>
          
          <List sx={{ flex: 1, py: 0 }}>
            {chatRooms.map((room) => (
              <ListItemButton
                key={room.id}
                selected={selectedRoom === room.id}
                onClick={() => setSelectedRoom(room.id)}
                sx={{ py: 2 }}
              >
                <ListItemAvatar>
                  <Avatar sx={{ width: 32, height: 32, bgcolor: room.type === 'private' ? '#4caf50' : '#2196f3' }}>
                    {room.type === 'private' ? <LockIcon sx={{ fontSize: 18 }} /> : <PublicIcon sx={{ fontSize: 18 }} />}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Typography variant="body2" sx={{ fontWeight: selectedRoom === room.id ? 'bold' : 'normal' }}>
                      {room.name}
                    </Typography>
                  }
                  secondary={
                    <Typography variant="caption" color="text.secondary">
                      {room.type === 'private' ? `${room.participants?.length || 0} players` : 'Everyone'}
                    </Typography>
                  }
                />
              </ListItemButton>
            ))}
          </List>
        </Box>

        {/* Chat Area */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Chat Header */}
          <Box sx={{ 
            p: { xs: 1, md: 2 }, 
            borderBottom: '1px solid #e0e0e0', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            minHeight: { xs: '56px', md: 'auto' }
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {currentRoom?.type === 'private' ? <LockIcon color="success" /> : <PublicIcon color="primary" />}
              <Typography variant="h6" sx={{ fontWeight: 'bold', fontSize: { xs: '1rem', md: '1.25rem' } }}>
                {currentRoom?.name}
              </Typography>
              {currentRoom?.type === 'private' && (
                <Chip 
                  icon={<GroupIcon />} 
                  label={`${currentRoom.participants?.length || 0} players`}
                  size="small"
                  color="success"
                  sx={{ display: { xs: 'none', sm: 'flex' } }}
                />
              )}
            </Box>
            <IconButton onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>

          {/* Messages */}
          <Box sx={{ 
            flex: 1, 
            overflow: 'auto', 
            p: { xs: 0.5, md: 1 },
            display: 'flex',
            flexDirection: 'column'
          }}>
            {messages.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.875rem', md: '1rem' } }}>
                  {selectedRoom === 'private' 
                    ? `No messages yet in this game room. Start chatting with your opponent!`
                    : `No messages yet. Start the conversation!`
                  }
                </Typography>
              </Box>
            ) : (
              messages.map((message) => {
                const isOwnMessage = message.sender_id === publicKey?.toString();
                return (
                  <Box
                    key={message.id}
                    sx={{
                      mb: 1,
                      p: { xs: 1.5, md: 2 },
                      borderRadius: 2,
                      maxWidth: { xs: '90%', md: '85%' },
                      alignSelf: isOwnMessage ? 'flex-end' : 'flex-start',
                      bgcolor: isOwnMessage 
                        ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                        : 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                      background: isOwnMessage
                        ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                        : 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                      color: 'white',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                      position: 'relative',
                      '&::before': isOwnMessage ? {
                        content: '""',
                        position: 'absolute',
                        right: -8,
                        top: 10,
                        width: 0,
                        height: 0,
                        borderLeft: '8px solid #764ba2',
                        borderTop: '8px solid transparent',
                        borderBottom: '8px solid transparent',
                        display: { xs: 'none', md: 'block' }
                      } : {
                        content: '""',
                        position: 'absolute',
                        left: -8,
                        top: 10,
                        width: 0,
                        height: 0,
                        borderRight: '8px solid #00f2fe',
                        borderTop: '8px solid transparent',
                        borderBottom: '8px solid transparent',
                        display: { xs: 'none', md: 'block' }
                      }
                    }}
                  >
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        color: 'rgba(255,255,255,0.9)',
                        fontWeight: 'bold',
                        display: 'block',
                        mb: 0.5,
                        fontSize: { xs: '0.625rem', md: '0.75rem' }
                      }}
                    >
                      {message.sender_username} • {new Date(message.created_at).toLocaleTimeString()}
                    </Typography>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        color: 'white',
                        fontWeight: '500',
                        lineHeight: 1.4,
                        fontSize: { xs: '0.875rem', md: '1rem' }
                      }}
                    >
                      {message.content}
                    </Typography>
                  </Box>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </Box>

          {/* Message Input */}
          <Box sx={{ 
            p: { xs: 1, md: 2 }, 
            borderTop: '1px solid #e0e0e0',
            backgroundColor: 'white'
          }}>
            <TextField
              fullWidth
              size="small"
              placeholder={`Type a message in ${currentRoom?.name}...`}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
              multiline
              maxRows={3}
              sx={{
                '& .MuiOutlinedInput-root': {
                  fontSize: { xs: '0.875rem', md: '1rem' }
                }
              }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end" sx={{ alignSelf: 'flex-end', mb: 0.5 }}>
                    <IconButton
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim() || loading}
                      size="small"
                      color="primary"
                    >
                      <SendIcon />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
}