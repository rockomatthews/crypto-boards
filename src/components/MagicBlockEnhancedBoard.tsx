'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { 
  Box, 
  Typography, 
  Button, 
  Paper, 
  Alert, 
  Chip, 
  LinearProgress,
  Grid,
  Card,
  CardContent,
  Divider
} from '@mui/material';
import { PublicKey } from '@solana/web3.js';
import { magicBlockManager, GameMove } from '../lib/magicblock';

interface MagicBlockGameState {
  gameId: string;
  currentPlayer: 'red' | 'black';
  gameStatus: 'waiting' | 'delegating' | 'active' | 'finished';
  ephemeralSession?: string;
  delegationSignature?: string;
  moveCount: number;
  averageLatency: number;
}

interface MagicBlockEnhancedBoardProps {
  gameId: string;
}

export const MagicBlockEnhancedBoard: React.FC<MagicBlockEnhancedBoardProps> = ({ gameId }) => {
  const { publicKey, signTransaction } = useWallet();
  
  const [gameState, setGameState] = useState<MagicBlockGameState>({
    gameId,
    currentPlayer: 'red',
    gameStatus: 'waiting',
    moveCount: 0,
    averageLatency: 0
  });
  
  const [performanceMetrics, setPerformanceMetrics] = useState({
    mainnetLatency: 0,
    ephemeralLatency: 10,
    blockTime: 10,
    tps: 100000,
    advantages: []
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(true);
  const [realtimeData, setRealtimeData] = useState({
    lastMoveLatency: 0,
    sessionActive: false,
    movesExecuted: 0
  });

  const initializeMagicBlockSession = useCallback(async () => {
    if (!publicKey || !signTransaction) {
      setError('Wallet not connected');
      return;
    }

    setLoading(true);
    setGameState(prev => ({ ...prev, gameStatus: 'delegating' }));

    try {
      console.log('🚀 Initializing MagicBlock hybrid session...');
      
      const gameStateAccount = new PublicKey('11111111111111111111111111111111');
      
      const result = await magicBlockManager.initializeGameSession(
        gameId,
        gameStateAccount,
        publicKey,
        signTransaction
      );

      if (result.success) {
        setGameState(prev => ({
          ...prev,
          gameStatus: 'active',
          ephemeralSession: result.ephemeralSession,
          delegationSignature: result.delegationSignature
        }));

        setRealtimeData(prev => ({ ...prev, sessionActive: true }));
        console.log('✅ MagicBlock session initialized successfully!');
        setError(null);
      } else {
        throw new Error(result.error || 'Failed to initialize MagicBlock session');
      }
    } catch (error) {
      console.error('❌ Failed to initialize MagicBlock session:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
      setGameState(prev => ({ ...prev, gameStatus: 'waiting' }));
    } finally {
      setLoading(false);
    }
  }, [publicKey, signTransaction, gameId]);

  const executeRealtimeMove = useCallback(async (moveData: Partial<GameMove>) => {
    if (!publicKey || !gameState.ephemeralSession) {
      setError('Session not active');
      return;
    }

    const startTime = Date.now();
    setLoading(true);

    try {
      const fullMoveData: GameMove = {
        gameId,
        playerId: publicKey.toString(),
        moveType: 'piece_move',
        fromPosition: { row: 0, col: 0 },
        toPosition: { row: 1, col: 1 },
        timestamp: Date.now(),
        ephemeral: true,
        ...moveData
      };

      console.log('⚡ Executing real-time move on ephemeral rollup...');
      
      const result = await magicBlockManager.executeGameMove(
        gameId,
        gameState.ephemeralSession,
        fullMoveData,
        publicKey
      );

      if (result.success) {
        const latency = Date.now() - startTime;
        
        setGameState(prev => ({
          ...prev,
          moveCount: prev.moveCount + 1,
          averageLatency: ((prev.averageLatency * prev.moveCount) + latency) / (prev.moveCount + 1),
          currentPlayer: prev.currentPlayer === 'red' ? 'black' : 'red'
        }));

        setRealtimeData(prev => ({
          ...prev,
          lastMoveLatency: latency,
          movesExecuted: prev.movesExecuted + 1
        }));

        console.log(`⚡ Move executed in ${latency}ms on ephemeral rollup!`);
        setError(null);
      } else {
        throw new Error(result.error || 'Failed to execute move');
      }
    } catch (error) {
      console.error('❌ Failed to execute real-time move:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [publicKey, gameState.ephemeralSession, gameId]);

  const commitToMainnet = useCallback(async () => {
    if (!publicKey || !signTransaction || !gameState.ephemeralSession) {
      setError('Cannot commit: missing requirements');
      return;
    }

    setLoading(true);

    try {
      console.log('🔄 Committing final game state to mainnet...');
      
      const finalGameState = {
        winner: gameState.currentPlayer === 'red' ? 'black' : 'red',
        moveCount: gameState.moveCount,
        gameId
      };

      const result = await magicBlockManager.commitGameState(
        gameId,
        gameState.ephemeralSession,
        finalGameState,
        publicKey,
        signTransaction
      );

      if (result.success) {
        setGameState(prev => ({ ...prev, gameStatus: 'finished' }));
        setRealtimeData(prev => ({ ...prev, sessionActive: false }));
        console.log('✅ Game state committed to mainnet successfully!');
        setError(null);
      } else {
        throw new Error(result.error || 'Failed to commit to mainnet');
      }
    } catch (error) {
      console.error('❌ Failed to commit to mainnet:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [publicKey, signTransaction, gameState, gameId]);

  useEffect(() => {
    const loadMetrics = async () => {
      try {
        const metrics = await magicBlockManager.getPerformanceMetrics();
        setPerformanceMetrics(metrics);
      } catch (error) {
        console.error('Failed to load performance metrics:', error);
      }
    };

    loadMetrics();
  }, []);

  useEffect(() => {
    if (isDemoMode && gameState.gameStatus === 'active') {
      const interval = setInterval(() => {
        if (gameState.moveCount < 20) {
          executeRealtimeMove({
            moveType: 'piece_move',
            fromPosition: { row: Math.floor(Math.random() * 8), col: Math.floor(Math.random() * 8) },
            toPosition: { row: Math.floor(Math.random() * 8), col: Math.floor(Math.random() * 8) }
          });
        } else {
          setIsDemoMode(false);
        }
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [isDemoMode, gameState.gameStatus, gameState.moveCount, executeRealtimeMove]);

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      <Paper sx={{ 
        p: 3, 
        mb: 3, 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        borderRadius: 3
      }}>
        <Typography variant="h3" align="center" gutterBottom sx={{ fontWeight: 'bold' }}>
          ⚡ MagicBlock Enhanced Gaming ⚡
        </Typography>
        <Typography variant="h6" align="center" sx={{ opacity: 0.9 }}>
          Hybrid Architecture: SOL Betting on Mainnet + 10ms Real-time Moves
        </Typography>
        
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 2 }}>
          <Chip 
            label={`Status: ${gameState.gameStatus.toUpperCase()}`}
            color={gameState.gameStatus === 'active' ? 'success' : 'default'}
            sx={{ fontWeight: 'bold' }}
          />
          <Chip 
            label={`Moves: ${gameState.moveCount}`}
            color="info"
            sx={{ fontWeight: 'bold' }}
          />
          {realtimeData.sessionActive && (
            <Chip 
              label="🚀 Ephemeral Session Active"
              color="success"
              sx={{ fontWeight: 'bold' }}
            />
          )}
        </Box>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%', borderRadius: 3 }}>
            <CardContent>
              <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', color: '#667eea' }}>
                📊 Real-time Performance
              </Typography>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Mainnet Latency vs Ephemeral Rollup
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption">Mainnet: {performanceMetrics.mainnetLatency}ms</Typography>
                    <LinearProgress 
                      variant="determinate" 
                      value={Math.min(performanceMetrics.mainnetLatency / 4, 100)} 
                      sx={{ height: 8, borderRadius: 1, bgcolor: '#ffebee' }}
                      color="error"
                    />
                  </Box>
                  <Typography variant="h6" sx={{ color: '#f44336' }}>vs</Typography>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption">Ephemeral: {performanceMetrics.ephemeralLatency}ms</Typography>
                    <LinearProgress 
                      variant="determinate" 
                      value={performanceMetrics.ephemeralLatency / 4} 
                      sx={{ height: 8, borderRadius: 1, bgcolor: '#e8f5e8' }}
                      color="success"
                    />
                  </Box>
                </Box>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Paper sx={{ p: 2, bgcolor: '#f5f5f5', textAlign: 'center' }}>
                    <Typography variant="h4" sx={{ color: '#4caf50', fontWeight: 'bold' }}>
                      {performanceMetrics.blockTime}ms
                    </Typography>
                    <Typography variant="caption">Block Time</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6}>
                  <Paper sx={{ p: 2, bgcolor: '#f5f5f5', textAlign: 'center' }}>
                    <Typography variant="h4" sx={{ color: '#2196f3', fontWeight: 'bold' }}>
                      {(performanceMetrics.tps / 1000).toFixed(0)}K
                    </Typography>
                    <Typography variant="caption">TPS</Typography>
                  </Paper>
                </Grid>
              </Grid>

              {realtimeData.lastMoveLatency > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#4caf50' }}>
                    ⚡ Last Move: {realtimeData.lastMoveLatency}ms
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%', borderRadius: 3 }}>
            <CardContent>
              <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', color: '#764ba2' }}>
                🎮 Game Controls
              </Typography>

              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Current Player: {gameState.currentPlayer.toUpperCase()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Average Move Latency: {gameState.averageLatency.toFixed(1)}ms
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {gameState.gameStatus === 'waiting' && (
                  <Button
                    variant="contained"
                    size="large"
                    onClick={initializeMagicBlockSession}
                    disabled={loading || !publicKey}
                    sx={{ 
                      bgcolor: '#667eea',
                      '&:hover': { bgcolor: '#5a67d8' },
                      fontWeight: 'bold',
                      py: 2
                    }}
                  >
                    {loading ? 'Initializing...' : '🚀 Start MagicBlock Session'}
                  </Button>
                )}

                {gameState.gameStatus === 'active' && (
                  <>
                    <Button
                      variant="contained"
                      onClick={() => executeRealtimeMove({ moveType: 'piece_move' })}
                      disabled={loading}
                      sx={{ 
                        bgcolor: '#4caf50',
                        '&:hover': { bgcolor: '#45a049' },
                        fontWeight: 'bold'
                      }}
                    >
                      ⚡ Execute Real-time Move
                    </Button>
                    
                    <Button
                      variant="outlined"
                      onClick={() => setIsDemoMode(!isDemoMode)}
                      sx={{ fontWeight: 'bold' }}
                    >
                      {isDemoMode ? '⏸️ Stop Demo' : '▶️ Start Demo'}
                    </Button>

                    <Button
                      variant="contained"
                      onClick={commitToMainnet}
                      disabled={loading || gameState.moveCount < 5}
                      sx={{ 
                        bgcolor: '#ff9800',
                        '&:hover': { bgcolor: '#f57c00' },
                        fontWeight: 'bold'
                      }}
                    >
                      🔄 Commit to Mainnet
                    </Button>
                  </>
                )}

                {gameState.gameStatus === 'finished' && (
                  <Alert severity="success">
                    <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                      🎉 Game completed! Final state committed to mainnet.
                    </Typography>
                  </Alert>
                )}
              </Box>

              {loading && (
                <Box sx={{ mt: 2 }}>
                  <LinearProgress sx={{ borderRadius: 1 }} />
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', color: '#667eea' }}>
                🌟 MagicBlock Advantages
              </Typography>
              
              <Grid container spacing={2}>
                {performanceMetrics.advantages.map((advantage, index) => (
                  <Grid item xs={12} sm={6} md={4} key={index}>
                    <Paper sx={{ 
                      p: 2, 
                      bgcolor: '#f5f7fa',
                      borderRadius: 2
                    }}>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        ✅ {advantage}
                      </Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>

              <Box sx={{ mt: 3, p: 2, bgcolor: '#e3f2fd', borderRadius: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1976d2' }}>
                  💡 Hybrid Architecture Benefits:
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  • <strong>SOL Betting & Escrow:</strong> Stays secure on Solana mainnet with 4% platform fees<br/>
                  • <strong>Game Moves:</strong> Execute instantly on 10ms ephemeral rollups<br/>
                  • <strong>Final State:</strong> Commits back to mainnet for permanent record<br/>
                  • <strong>User Experience:</strong> Best of both worlds - security + speed
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {gameState.ephemeralSession && (
        <Paper sx={{ p: 2, mt: 3, bgcolor: '#f9f9f9', borderRadius: 2 }}>
          <Typography variant="body2" color="text.secondary">
            <strong>Ephemeral Session:</strong> {gameState.ephemeralSession}<br/>
            <strong>Delegation Signature:</strong> {gameState.delegationSignature}
          </Typography>
        </Paper>
      )}
    </Box>
  );
};

export default MagicBlockEnhancedBoard; 