import GameCarousel from '../components/GameCarousel';
import { LobbyList } from '../components/LobbyList';
import { GameFeed } from '../components/GameFeed';
import { Box, Paper, Typography, Button } from '@mui/material';
import { Link } from 'react-router-dom';
import { WalletMultiButton } from '@solana/wallet-adapter-react';

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
          <Button
            component={Link}
            href="/magicblock-demo"
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
        </Paper>
        
        <WalletMultiButton />
      </Paper>

      <GameCarousel />
      <LobbyList />
      <GameFeed />
    </Box>
  );
}
