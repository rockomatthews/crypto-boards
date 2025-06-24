'use client';

import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { 
  Box, 
  Typography, 
  Button, 
  Paper, 
  Alert
} from '@mui/material';
import { PublicKey } from '@solana/web3.js';
import { magicBlockManager } from '../../lib/magicblock';

export default function MagicBlockDemo() {
  const { publicKey, signTransaction } = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [moveCount, setMoveCount] = useState(0);
  const [averageLatency, setAverageLatency] = useState(0);

  const gameId = 'demo-game-123';
  const [ephemeralSession, setEphemeralSession] = useState<string | null>(null);

  const initializeSession = async () => {
    if (!publicKey || !signTransaction) {
      setError('Please connect your wallet first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🚀 Initializing MagicBlock session...');
      
      const gameStateAccount = new PublicKey('11111111111111111111111111111111');
      
      const result = await magicBlockManager.initializeGameSession(
        gameId,
        gameStateAccount,
        publicKey,
        signTransaction
      );

      if (result.success) {
        setSessionActive(true);
        setEphemeralSession(result.ephemeralSession || null);
        console.log('✅ MagicBlock session initialized!');
      } else {
        throw new Error(result.error || 'Failed to initialize session');
      }
    } catch (error) {
      console.error('❌ Session initialization failed:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const executeMove = async () => {
    if (!publicKey || !ephemeralSession) {
      setError('Session not active');
      return;
    }

    const startTime = Date.now();
    setLoading(true);

    try {
      const moveData = {
        gameId,
        playerId: publicKey.toString(),
        moveType: 'piece_move' as const,
        fromPosition: { row: Math.floor(Math.random() * 8), col: Math.floor(Math.random() * 8) },
        toPosition: { row: Math.floor(Math.random() * 8), col: Math.floor(Math.random() * 8) },
        timestamp: Date.now(),
        ephemeral: true
      };

      console.log('⚡ Executing real-time move...');
      
      const result = await magicBlockManager.executeGameMove(
        gameId,
        ephemeralSession,
        moveData,
        publicKey
      );

      if (result.success) {
        const latency = Date.now() - startTime;
        setMoveCount(prev => prev + 1);
        setAverageLatency(prev => ((prev * moveCount) + latency) / (moveCount + 1));
        console.log(`⚡ Move executed in ${latency}ms!`);
      } else {
        throw new Error(result.error || 'Failed to execute move');
      }
    } catch (error) {
      console.error('❌ Move execution failed:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const commitToMainnet = async () => {
    if (!publicKey || !signTransaction || !ephemeralSession) {
      setError('Cannot commit: session not active');
      return;
    }

    setLoading(true);

    try {
      console.log('🔄 Committing to mainnet...');
      
      const finalState = {
        gameId,
        moveCount,
        winner: 'red',
        completedAt: Date.now()
      };

      const result = await magicBlockManager.commitGameState(
        gameId,
        ephemeralSession,
        finalState,
        publicKey,
        signTransaction
      );

      if (result.success) {
        console.log('✅ Committed to mainnet!');
        setSessionActive(false);
        setEphemeralSession(null);
      } else {
        throw new Error(result.error || 'Failed to commit');
      }
    } catch (error) {
      console.error('❌ Commit failed:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
      <Paper sx={{ 
        p: 4, 
        mb: 3, 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        borderRadius: 3
      }}>
        <Typography variant="h3" align="center" gutterBottom sx={{ fontWeight: 'bold' }}>
          ⚡ MagicBlock Integration Demo ⚡
        </Typography>
        <Typography variant="h6" align="center" sx={{ opacity: 0.9 }}>
          Hybrid Architecture: SOL Betting on Mainnet + 10ms Real-time Moves
        </Typography>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', color: '#667eea' }}>
          🎮 Demo Controls
        </Typography>
        
        <Box sx={{ mb: 3 }}>
          <Typography variant="body1" gutterBottom>
            <strong>Session Status:</strong> {sessionActive ? '🟢 Active' : '🔴 Inactive'}
          </Typography>
          <Typography variant="body1" gutterBottom>
            <strong>Moves Executed:</strong> {moveCount}
          </Typography>
          <Typography variant="body1" gutterBottom>
            <strong>Average Latency:</strong> {averageLatency.toFixed(1)}ms
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 400 }}>
          {!sessionActive && (
            <Button
              variant="contained"
              size="large"
              onClick={initializeSession}
              disabled={loading || !publicKey}
              sx={{ 
                bgcolor: '#667eea',
                '&:hover': { bgcolor: '#5a67d8' },
                fontWeight: 'bold'
              }}
            >
              {loading ? 'Initializing...' : '🚀 Initialize MagicBlock Session'}
            </Button>
          )}

          {sessionActive && (
            <>
              <Button
                variant="contained"
                onClick={executeMove}
                disabled={loading}
                sx={{ 
                  bgcolor: '#4caf50',
                  '&:hover': { bgcolor: '#45a049' },
                  fontWeight: 'bold'
                }}
              >
                {loading ? 'Executing...' : '⚡ Execute Real-time Move (10ms)'}
              </Button>

              <Button
                variant="contained"
                onClick={commitToMainnet}
                disabled={loading || moveCount < 3}
                sx={{ 
                  bgcolor: '#ff9800',
                  '&:hover': { bgcolor: '#f57c00' },
                  fontWeight: 'bold'
                }}
              >
                {loading ? 'Committing...' : '🔄 Commit Final State to Mainnet'}
              </Button>
            </>
          )}
        </Box>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', color: '#764ba2' }}>
          📊 Performance Comparison
        </Typography>
        
        <Box sx={{ display: 'flex', justifyContent: 'space-around', mb: 3 }}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4" sx={{ color: '#f44336', fontWeight: 'bold' }}>
              400ms
            </Typography>
            <Typography variant="body2">Solana Mainnet</Typography>
          </Box>
          <Typography variant="h4" sx={{ color: '#666' }}>vs</Typography>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4" sx={{ color: '#4caf50', fontWeight: 'bold' }}>
              10ms
            </Typography>
            <Typography variant="body2">MagicBlock Ephemeral</Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-around' }}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h5" sx={{ color: '#2196f3', fontWeight: 'bold' }}>
              100K
            </Typography>
            <Typography variant="body2">TPS Capacity</Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h5" sx={{ color: '#4caf50', fontWeight: 'bold' }}>
              10ms
            </Typography>
            <Typography variant="body2">Block Time</Typography>
          </Box>
        </Box>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', color: '#667eea' }}>
          🌟 MagicBlock Advantages
        </Typography>
        
        <Typography variant="body1" sx={{ mb: 1 }}>
          ✅ Near-instant moves (10ms vs 400ms)
        </Typography>
        <Typography variant="body1" sx={{ mb: 1 }}>
          ✅ Gasless transactions during gameplay
        </Typography>
        <Typography variant="body1" sx={{ mb: 1 }}>
          ✅ SOL betting stays secure on mainnet
        </Typography>
        <Typography variant="body1" sx={{ mb: 1 }}>
          ✅ No ecosystem fragmentation
        </Typography>
        <Typography variant="body1" sx={{ mb: 1 }}>
          ✅ Horizontal scaling capability
        </Typography>

        <Box sx={{ mt: 3, p: 2, bgcolor: '#e3f2fd', borderRadius: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1976d2' }}>
            💡 How It Works:
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            1. <strong>SOL Betting:</strong> Secure escrow contracts on Solana mainnet<br/>
            2. <strong>Game Moves:</strong> Lightning-fast execution on ephemeral rollups<br/>
            3. <strong>Final State:</strong> Commit back to mainnet for permanent record<br/>
            4. <strong>Best UX:</strong> Users get Web2 speed with Web3 security
          </Typography>
        </Box>
      </Paper>

      {ephemeralSession && (
        <Paper sx={{ p: 2, mt: 3, bgcolor: '#f5f5f5' }}>
          <Typography variant="caption" color="text.secondary">
            Ephemeral Session: {ephemeralSession}
          </Typography>
        </Paper>
      )}
    </Box>
  );
} 