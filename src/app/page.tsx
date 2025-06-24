import GameCarousel from '../components/GameCarousel';
import { LobbyList } from '../components/LobbyList';
import { GameFeed } from '../components/GameFeed';
import { Box, Paper, Typography, Button } from '@mui/material';
import Link from 'next/link';

export default function Home() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5' }}>
      {/* Header with enhanced branding */}
      <Paper sx={{ 
        p: 4, 
        mb: 4, 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        textAlign: 'center'
      }}>
        <Typography variant="h2" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
          🎮 Crypto Boards 🎮
        </Typography>
        <Typography variant="h5" sx={{ opacity: 0.9, mb: 3 }}>
          Real SOL betting • Live stats • Global chat • 15-min games
        </Typography>
        
        {/* MagicBlock Integration Banner */}
        <Paper sx={{ 
          p: 2, 
          mb: 3, 
          bgcolor: 'rgba(255,255,255,0.1)', 
          borderRadius: 2,
          border: '2px solid rgba(255,255,255,0.3)'
        }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
            ⚡ NEW: MagicBlock Integration ⚡
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, opacity: 0.9 }}>
            Experience 10ms real-time moves on ephemeral rollups while keeping SOL betting secure on mainnet!
          </Typography>
          <Link href="/magicblock-demo" passHref>
            <Button
              variant="contained"
              size="large"
              sx={{ 
                bgcolor: '#4caf50',
                '&:hover': { bgcolor: '#45a049' },
                fontWeight: 'bold',
                textTransform: 'none'
              }}
            >
              🚀 Try MagicBlock Demo
            </Button>
          </Link>
        </Paper>
      </Paper>

      <GameCarousel />
      
      {/* MagicBlock Integration Showcase */}
      <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3, mb: 4 }}>
        <Paper sx={{ 
          p: 4, 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          borderRadius: 3,
          textAlign: 'center'
        }}>
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold' }}>
            ⚡ MagicBlock Integration ⚡
          </Typography>
          <Typography variant="h6" sx={{ mb: 2, opacity: 0.9 }}>
            Breakthrough Hybrid Architecture
          </Typography>
          <Typography variant="body1" sx={{ mb: 3, maxWidth: 600, mx: 'auto' }}>
            Experience the future of blockchain gaming with 10ms real-time moves on ephemeral rollups 
            while keeping SOL betting and escrow secure on Solana mainnet. No bridges, no fragmentation!
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/magicblock-demo" passHref>
              <Button
                variant="contained"
                size="large"
                sx={{ 
                  bgcolor: '#4caf50',
                  '&:hover': { bgcolor: '#45a049' },
                  fontWeight: 'bold',
                  textTransform: 'none',
                  px: 4
                }}
              >
                🚀 Try Interactive Demo
              </Button>
            </Link>
            
            <Button
              variant="outlined"
              size="large"
              sx={{ 
                borderColor: 'white',
                color: 'white',
                '&:hover': { 
                  borderColor: 'white',
                  bgcolor: 'rgba(255,255,255,0.1)' 
                },
                fontWeight: 'bold',
                textTransform: 'none',
                px: 4
              }}
            >
              📊 View Performance
            </Button>
          </Box>
          
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center', gap: 4, flexWrap: 'wrap' }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#4caf50' }}>
                10ms
              </Typography>
              <Typography variant="caption">Move Latency</Typography>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#ffeb3b' }}>
                Gasless
              </Typography>
              <Typography variant="caption">Game Moves</Typography>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#ff5722' }}>
                100%
              </Typography>
              <Typography variant="caption">SOL Security</Typography>
            </Box>
          </Box>
        </Paper>
      </Box>
      
      <LobbyList />
      <GameFeed />
    </Box>
  );
}
