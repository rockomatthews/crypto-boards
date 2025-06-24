'use client';

import React, { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  Box,
  List,
  ListItem,
  Chip,
  Divider,
  CircularProgress,
  Alert
} from '@mui/material';

interface GameFeedItem {
  id: string;
  gameType: string;
  entryFee: number;
  payoutAmount: number | null;
  endedAt: string;
  winner: {
    username: string;
    wallet: string;
  };
  loser: {
    username: string;
    wallet: string;
  };
}

export const GameFeed: React.FC = () => {
  const [feedItems, setFeedItems] = useState<GameFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGameFeed = async () => {
    try {
      const response = await fetch('/api/games/feed?limit=15');
      if (response.ok) {
        const data = await response.json();
        setFeedItems(data.feed);
        setError(null);
      } else {
        throw new Error('Failed to fetch game feed');
      }
    } catch (error) {
      console.error('Error fetching game feed:', error);
      setError('Failed to load game feed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGameFeed();
    
    // Poll for updates every 10 seconds
    const interval = setInterval(fetchGameFeed, 10000);
    
    return () => clearInterval(interval);
  }, []);

  const getGameTypeEmoji = (gameType: string) => {
    switch (gameType) {
      case 'checkers': return '🏁';
      case 'chess': return '♟️';
      case 'go': return '⚫';
      case 'poker': return '🃏';
      default: return '🎮';
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  const formatSOL = (amount: number) => {
    return `${amount.toFixed(4)} SOL`;
  };

  const truncateUsername = (username: string, maxLength: number = 12) => {
    return username.length > maxLength ? `${username.slice(0, maxLength)}...` : username;
  };

  if (loading) {
    return (
      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', color: '#8B4513' }}>
          📺 Live Game Feed
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3, mt: 3, minHeight: '400px' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#8B4513', flexGrow: 1 }}>
          📺 Live Game Feed
        </Typography>
        <Chip 
          label="LIVE" 
          color="error" 
          size="small" 
          sx={{ animation: 'pulse 2s infinite' }}
        />
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {feedItems.length === 0 && !loading ? (
        <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
          <Typography variant="h6">🎮 No games completed yet</Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Be the first to complete a game and appear in the feed!
          </Typography>
        </Box>
      ) : (
        <List sx={{ maxHeight: '500px', overflow: 'auto' }}>
          {feedItems.map((item, index) => (
            <React.Fragment key={item.id}>
              <ListItem 
                sx={{ 
                  px: 0, 
                  py: 1.5,
                  '&:hover': { 
                    bgcolor: 'rgba(139, 69, 19, 0.05)',
                    borderRadius: 1
                  }
                }}
              >
                <Box sx={{ width: '100%' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                    <Typography variant="body1" sx={{ flexGrow: 1 }}>
                      <span style={{ fontWeight: 'bold', color: '#d32f2f' }}>
                        {truncateUsername(item.loser.username)}
                      </span>
                      <span style={{ color: '#666', margin: '0 8px' }}>lost</span>
                      <span style={{ fontWeight: 'bold', color: '#ff9800' }}>
                        {formatSOL(item.entryFee)}
                      </span>
                      <span style={{ color: '#666', margin: '0 8px' }}>to</span>
                      <span style={{ fontWeight: 'bold', color: '#2e7d32' }}>
                        {truncateUsername(item.winner.username)}
                      </span>
                      <span style={{ color: '#666', margin: '0 8px' }}>playing</span>
                      <span style={{ fontWeight: 'bold', color: '#8B4513' }}>
                        {getGameTypeEmoji(item.gameType)} {item.gameType}
                      </span>
                    </Typography>
                    
                    <Typography variant="caption" color="textSecondary" sx={{ ml: 2 }}>
                      {formatTimeAgo(item.endedAt)}
                    </Typography>
                  </Box>
                  
                  {item.payoutAmount && (
                    <Typography variant="caption" color="textSecondary">
                      Winner received {formatSOL(item.payoutAmount)}
                    </Typography>
                  )}
                </Box>
              </ListItem>
              
              {index < feedItems.length - 1 && (
                <Divider sx={{ bgcolor: 'rgba(139, 69, 19, 0.1)' }} />
              )}
            </React.Fragment>
          ))}
        </List>
      )}

      <style jsx global>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
    </Paper>
  );
}; 