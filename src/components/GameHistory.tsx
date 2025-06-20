'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Divider
} from '@mui/material';
import {
  EmojiEvents
} from '@mui/icons-material';

interface GameHistoryProps {
  playerId?: string;
}

interface GameRecord {
  id: string;
  game_type: string;
  status: string;
  entry_fee: number;
  created_at: string;
  started_at: string;
  ended_at: string;
  game_status?: string;
  is_winner?: boolean;
  player_username?: string;
  player_wallet?: string;
  total_players?: number;
  winner_count?: number;
  payout_amount?: number;
  total_payout?: number;
  payout_signature?: string;
}

interface PlayerStats {
  totalGames: number;
  wins: number;
  losses: number;
  winRate: string;
  totalWinnings: number;
  totalEntryFees: number;
  netProfit: number;
  avgGameDuration: number;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`game-history-tabpanel-${index}`}
      aria-labelledby={`game-history-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export default function GameHistory({ playerId }: GameHistoryProps) {
  const [games, setGames] = useState<GameRecord[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);

  const fetchGameHistory = async (newOffset = 0) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        limit: '10',
        offset: newOffset.toString(),
        ...(playerId && { playerId })
      });

      const response = await fetch(`/api/games/history?${params}`);
      const data = await response.json();

      if (response.ok) {
        if (newOffset === 0) {
          setGames(data.games);
        } else {
          setGames(prev => [...prev, ...data.games]);
        }
        setPlayerStats(data.playerStats);
        setHasMore(data.pagination.hasMore);
        setOffset(newOffset + data.games.length);
      } else {
        setError(data.error || 'Failed to fetch game history');
      }
    } catch {
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGameHistory();
  }, [playerId]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const loadMore = () => {
    fetchGameHistory(offset);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getGameStatusColor = (status: string): 'success' | 'warning' | 'info' | 'default' => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'in_progress':
        return 'warning';
      case 'waiting':
        return 'info';
      default:
        return 'default';
    }
  };

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Game History
      </Typography>

      {playerStats && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Player Statistics
            </Typography>
            <Box display="flex" flexWrap="wrap" gap={3}>
              <Box textAlign="center" minWidth={150}>
                <Typography variant="h4" color="primary">
                  {playerStats.totalGames}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Games
                </Typography>
              </Box>
              <Box textAlign="center" minWidth={150}>
                <Typography variant="h4" color="success.main">
                  {playerStats.wins}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Wins ({playerStats.winRate}%)
                </Typography>
              </Box>
              <Box textAlign="center" minWidth={150}>
                <Typography variant="h4" color="error.main">
                  {playerStats.losses}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Losses
                </Typography>
              </Box>
              <Box textAlign="center" minWidth={150}>
                <Typography variant="h4" color={playerStats.netProfit >= 0 ? 'success.main' : 'error.main'}>
                  {playerStats.netProfit.toFixed(2)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Net Profit (SOL)
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="Recent Games" />
          <Tab label="Statistics" />
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Game Type</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Entry Fee</TableCell>
                <TableCell>Players</TableCell>
                <TableCell>Result</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Payout</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {games.map((game) => (
                <TableRow key={game.id}>
                  <TableCell>
                    <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                      {game.game_type}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={game.status}
                      color={getGameStatusColor(game.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{game.entry_fee} SOL</TableCell>
                  <TableCell>{game.total_players || game.winner_count || '-'}</TableCell>
                  <TableCell>
                    {game.is_winner !== undefined ? (
                      game.is_winner ? (
                        <Chip
                          icon={<EmojiEvents />}
                          label="Winner"
                          color="success"
                          size="small"
                        />
                      ) : (
                        <Chip label="Lost" color="error" size="small" />
                      )
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>{formatDate(game.created_at)}</TableCell>
                  <TableCell>
                    {game.payout_amount || game.total_payout ? (
                      <Typography variant="body2" color="success.main">
                        {(game.payout_amount || game.total_payout)?.toFixed(2)} SOL
                      </Typography>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {hasMore && (
          <Box textAlign="center" mt={2}>
            <Button
              variant="outlined"
              onClick={loadMore}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} /> : null}
            >
              Load More
            </Button>
          </Box>
        )}

        {games.length === 0 && !loading && (
          <Box textAlign="center" py={4}>
            <Typography variant="body1" color="text.secondary">
              No games found
            </Typography>
          </Box>
        )}
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        {playerStats && (
          <Box display="flex" flexDirection="column" gap={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Financial Summary
                </Typography>
                <Box display="flex" flexDirection="column" gap={2}>
                  <Box display="flex" justifyContent="space-between">
                    <Typography>Total Winnings:</Typography>
                    <Typography color="success.main">
                      {playerStats.totalWinnings.toFixed(2)} SOL
                    </Typography>
                  </Box>
                  <Box display="flex" justifyContent="space-between">
                    <Typography>Total Entry Fees:</Typography>
                    <Typography color="error.main">
                      {playerStats.totalEntryFees.toFixed(2)} SOL
                    </Typography>
                  </Box>
                  <Divider />
                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="h6">Net Profit:</Typography>
                    <Typography
                      variant="h6"
                      color={playerStats.netProfit >= 0 ? 'success.main' : 'error.main'}
                    >
                      {playerStats.netProfit.toFixed(2)} SOL
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Performance Metrics
                </Typography>
                <Box display="flex" flexDirection="column" gap={2}>
                  <Box display="flex" justifyContent="space-between">
                    <Typography>Win Rate:</Typography>
                    <Typography color="success.main">
                      {playerStats.winRate}%
                    </Typography>
                  </Box>
                  <Box display="flex" justifyContent="space-between">
                    <Typography>Average Game Duration:</Typography>
                    <Typography>
                      {playerStats.avgGameDuration.toFixed(1)} min
                    </Typography>
                  </Box>
                  <Box display="flex" justifyContent="space-between">
                    <Typography>Games Played:</Typography>
                    <Typography>
                      {playerStats.totalGames}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Box>
        )}
      </TabPanel>
    </Box>
  );
} 