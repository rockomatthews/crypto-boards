'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Paper,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert
} from '@mui/material';
import { useWallet } from '@solana/wallet-adapter-react';

interface StatsModalProps {
  open: boolean;
  onClose: () => void;
}

interface GameStat {
  game_type: string;
  result: 'win' | 'loss';
  amount: string;
  created_at: string;
  game_id: string;
  opponent_username: string;
  opponent_wallet: string;
}

interface StatsData {
  summary: {
    totalGames: number;
    wins: number;
    losses: number;
    winRate: string;
    totalWinnings: string;
    totalLosses: string;
    netProfit: string;
    currentStreak: number;
    streakType: 'win' | 'loss' | 'none';
  };
  gameTypeStats: Record<string, {
    total: number;
    wins: number;
    losses: number;
    winnings: number;
    lossAmount: number;
  }>;
  recentGames: GameStat[];
}

export const StatsModal: React.FC<StatsModalProps> = ({ open, onClose }) => {
  const { publicKey } = useWallet();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!publicKey) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/profile/stats?wallet=${publicKey.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      } else {
        throw new Error('Failed to fetch stats');
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
      setError('Failed to load stats');
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    if (open && publicKey) {
      fetchStats();
    }
  }, [open, publicKey, fetchStats]);

  const getGameTypeEmoji = (gameType: string) => {
    switch (gameType) {
      case 'checkers': return '🏁';
      case 'chess': return '♟️';
      case 'go': return '⚫';
      case 'poker': return '🃏';
      default: return '🎮';
    }
  };

  const getStreakColor = (streakType: string): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    switch (streakType) {
      case 'win': return 'success';
      case 'loss': return 'error';
      default: return 'default';
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  const formatSOL = (amount: string | number) => {
    return `${parseFloat(amount.toString()).toFixed(4)} SOL`;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ 
        bgcolor: 'linear-gradient(45deg, #8B4513, #DEB887)',
        color: 'white',
        textAlign: 'center',
        fontWeight: 'bold'
      }}>
        📊 Game Statistics
      </DialogTitle>
      
      <DialogContent sx={{ p: 3 }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {stats && (
          <Box>
            {/* Summary Stats */}
            <Paper sx={{ p: 3, mb: 3, bgcolor: '#2d2d2d', color: 'white' }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', color: '#DEB887' }}>
                🏆 Overall Performance
              </Typography>
              
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 3 }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#2e7d32' }}>
                    {stats.summary.totalGames}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#ccc' }}>
                    Total Games
                  </Typography>
                </Box>
                
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#1976d2' }}>
                    {stats.summary.winRate}%
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Win Rate
                  </Typography>
                </Box>
                
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" sx={{ 
                    fontWeight: 'bold', 
                    color: parseFloat(stats.summary.netProfit) >= 0 ? '#2e7d32' : '#d32f2f'
                  }}>
                    {parseFloat(stats.summary.netProfit) >= 0 ? '+' : ''}{formatSOL(stats.summary.netProfit)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Net Profit/Loss
                  </Typography>
                </Box>
                
                <Box sx={{ textAlign: 'center' }}>
                  <Chip 
                    label={`${stats.summary.currentStreak} ${stats.summary.streakType} streak`}
                    color={getStreakColor(stats.summary.streakType)}
                    sx={{ fontWeight: 'bold' }}
                  />
                  <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                    Current Streak
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, mt: 2 }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h6" sx={{ color: '#2e7d32' }}>
                    {stats.summary.wins}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Wins
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h6" sx={{ color: '#d32f2f' }}>
                    {stats.summary.losses}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Losses
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h6" sx={{ color: '#ff9800' }}>
                    {formatSOL(stats.summary.totalWinnings)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Total Winnings
                  </Typography>
                </Box>
              </Box>
            </Paper>

            {/* Game Type Breakdown */}
            {Object.keys(stats.gameTypeStats).length > 0 && (
              <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', color: '#8B4513' }}>
                  🎮 Performance by Game Type
                </Typography>
                
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
                  {Object.entries(stats.gameTypeStats).map(([gameType, typeStats]) => (
                    <Paper key={gameType} sx={{ p: 2, border: '1px solid #e0e0e0' }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                        {getGameTypeEmoji(gameType)} {gameType.charAt(0).toUpperCase() + gameType.slice(1)}
                      </Typography>
                      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
                        <Box>
                          <Typography variant="body2">
                            <strong>Games:</strong> {typeStats.total}
                          </Typography>
                          <Typography variant="body2">
                            <strong>W/L:</strong> {typeStats.wins}/{typeStats.losses}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2">
                            <strong>Win Rate:</strong> {typeStats.total > 0 ? ((typeStats.wins / typeStats.total) * 100).toFixed(1) : '0.0'}%
                          </Typography>
                          <Typography variant="body2">
                            <strong>Net:</strong> {formatSOL(typeStats.winnings - typeStats.lossAmount)}
                          </Typography>
                        </Box>
                      </Box>
                    </Paper>
                  ))}
                </Box>
              </Paper>
            )}

            {/* Recent Games */}
            {stats.recentGames.length > 0 && (
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', color: '#8B4513' }}>
                  📋 Recent Games
                </Typography>
                
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>Game</strong></TableCell>
                        <TableCell><strong>Opponent</strong></TableCell>
                        <TableCell><strong>Result</strong></TableCell>
                        <TableCell><strong>Amount</strong></TableCell>
                        <TableCell><strong>Date</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {stats.recentGames.map((game, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            {getGameTypeEmoji(game.game_type)} {game.game_type}
                          </TableCell>
                          <TableCell>
                            {game.opponent_username}
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={game.result.toUpperCase()}
                              color={game.result === 'win' ? 'success' : 'error'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <Typography 
                              variant="body2" 
                              sx={{ 
                                color: game.result === 'win' ? '#2e7d32' : '#d32f2f',
                                fontWeight: 'bold'
                              }}
                            >
                              {game.result === 'win' ? '+' : '-'}{formatSOL(game.amount)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {formatDate(game.created_at)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            )}

            {stats.summary.totalGames === 0 && (
              <Paper sx={{ p: 4, textAlign: 'center', bgcolor: '#f8f9fa' }}>
                <Typography variant="h6" color="textSecondary">
                  🎮 No games played yet!
                </Typography>
                <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                  Start playing to see your statistics here.
                </Typography>
              </Paper>
            )}
          </Box>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose} variant="contained" sx={{ 
          bgcolor: '#8B4513', 
          '&:hover': { bgcolor: '#654321' } 
        }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}; 