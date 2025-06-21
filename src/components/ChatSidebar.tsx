'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  TextField,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Avatar,
  Chip,
  IconButton,
  Tabs,
  Tab,
  Badge,
  Divider,
  Paper,
  InputAdornment,
} from '@mui/material';
import {
  Send as SendIcon,
  PersonAdd as PersonAddIcon,
  Chat as ChatIcon,
  People as PeopleIcon,
  Close as CloseIcon,
  Search as SearchIcon,
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
}

interface OnlineUser {
  id: string;
  username: string;
  wallet_address: string;
  avatar_url?: string;
  is_friend: boolean;
  is_online: boolean;
  last_seen: string;
}

interface ChatSidebarProps {
  isVisible: boolean;
  onClose: () => void;
}

export default function ChatSidebar({ isVisible, onClose }: ChatSidebarProps) {
  const { publicKey } = useWallet();
  const [activeTab, setActiveTab] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = useCallback(async () => {
    if (!publicKey) return;
    
    try {
      const response = await fetch(`/api/chat/messages?walletAddress=${publicKey.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  }, [publicKey]);

  const fetchOnlineUsers = useCallback(async () => {
    if (!publicKey) return;
    
    try {
      const response = await fetch(`/api/chat/users?walletAddress=${publicKey.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setOnlineUsers(data);
      }
    } catch (error) {
      console.error('Error fetching online users:', error);
    }
  }, [publicKey]);

  useEffect(() => {
    if (isVisible && publicKey) {
      fetchMessages();
      fetchOnlineUsers();
      
      // Poll for updates every 3 seconds
      const interval = setInterval(() => {
        fetchMessages();
        fetchOnlineUsers();
      }, 3000);
      
      return () => clearInterval(interval);
    }
  }, [isVisible, publicKey, fetchMessages, fetchOnlineUsers]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!publicKey || !newMessage.trim()) return;

    setLoading(true);
    try {
      const response = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: publicKey.toString(),
          content: newMessage.trim(),
          messageType: 'text',
          isGlobal: true,
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

  const handleAddFriend = async (userId: string) => {
    if (!publicKey) return;

    try {
      const response = await fetch('/api/friends', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: publicKey.toString(),
          friendWalletAddress: onlineUsers.find(u => u.id === userId)?.wallet_address,
        }),
      });

      if (response.ok) {
        fetchOnlineUsers();
      }
    } catch (error) {
      console.error('Error adding friend:', error);
    }
  };

  const filteredUsers = onlineUsers.filter(user =>
    user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.wallet_address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const friends = filteredUsers.filter(user => user.is_friend);
  const otherUsers = filteredUsers.filter(user => !user.is_friend);

  if (!isVisible) return null;

  return (
    <Paper
      sx={{
        position: 'fixed',
        top: 64, // Below header
        right: 0,
        width: 350,
        height: 'calc(100vh - 64px)',
        zIndex: 1200,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '12px 0 0 0',
        boxShadow: '-4px 0 20px rgba(0,0,0,0.15)',
      }}
    >
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
          Community Chat
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(_, newValue) => setActiveTab(newValue)}
        variant="fullWidth"
        sx={{ borderBottom: '1px solid #e0e0e0' }}
      >
        <Tab icon={<ChatIcon />} label="Chat" />
        <Tab icon={<PeopleIcon />} label="Users" />
      </Tabs>

      {/* Content */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {activeTab === 0 ? (
          // Chat Tab
          <>
            {/* Messages */}
            <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
              {messages.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    No messages yet. Start the conversation!
                  </Typography>
                </Box>
              ) : (
                messages.map((message) => (
                  <Box
                    key={message.id}
                    sx={{
                      mb: 1,
                      p: 1,
                      borderRadius: 1,
                      bgcolor: message.sender_id === publicKey?.toString() ? 'primary.light' : 'grey.100',
                      alignSelf: message.sender_id === publicKey?.toString() ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      {message.sender_username} • {new Date(message.created_at).toLocaleTimeString()}
                    </Typography>
                    <Typography variant="body2">
                      {message.content}
                    </Typography>
                  </Box>
                ))
              )}
              <div ref={messagesEndRef} />
            </Box>

            {/* Message Input */}
            <Box sx={{ p: 2, borderTop: '1px solid #e0e0e0' }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={handleSendMessage}
                        disabled={!newMessage.trim() || loading}
                        size="small"
                      >
                        <SendIcon />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
          </>
        ) : (
          // Users Tab
          <>
            {/* Search */}
            <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0' }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>

            {/* Users List */}
            <Box sx={{ flex: 1, overflow: 'auto' }}>
              {/* Friends Section */}
              {friends.length > 0 && (
                <>
                  <Typography variant="subtitle2" sx={{ p: 2, pb: 1, fontWeight: 'bold' }}>
                    Friends ({friends.length})
                  </Typography>
                  <List dense>
                    {friends.map((user) => (
                      <ListItem key={user.id}>
                        <ListItemAvatar>
                          <Badge
                            color={user.is_online ? 'success' : 'default'}
                            variant="dot"
                            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                          >
                            <Avatar src={user.avatar_url}>
                              {user.username.charAt(0)}
                            </Avatar>
                          </Badge>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                              {user.username}
                            </Typography>
                          }
                          secondary={user.wallet_address.slice(0, 8) + '...'}
                        />
                        <ListItemSecondaryAction>
                          <Chip
                            label={user.is_online ? 'Online' : 'Offline'}
                            size="small"
                            color={user.is_online ? 'success' : 'default'}
                          />
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>
                  <Divider />
                </>
              )}

              {/* Other Users Section */}
              <Typography variant="subtitle2" sx={{ p: 2, pb: 1 }}>
                Other Players ({otherUsers.length})
              </Typography>
              <List dense>
                {otherUsers.map((user) => (
                  <ListItem key={user.id}>
                    <ListItemAvatar>
                      <Badge
                        color={user.is_online ? 'success' : 'default'}
                        variant="dot"
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                      >
                        <Avatar src={user.avatar_url}>
                          {user.username.charAt(0)}
                        </Avatar>
                      </Badge>
                    </ListItemAvatar>
                    <ListItemText
                      primary={user.username}
                      secondary={user.wallet_address.slice(0, 8) + '...'}
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                        onClick={() => handleAddFriend(user.id)}
                        size="small"
                        color="primary"
                      >
                        <PersonAddIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </Box>
          </>
        )}
      </Box>
    </Paper>
  );
} 