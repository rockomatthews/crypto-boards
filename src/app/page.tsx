import GameCarousel from '../components/GameCarousel';
import { LobbyList } from '../components/LobbyList';
import { GameFeed } from '../components/GameFeed';
import { Box, Paper, Typography } from '@mui/material';

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
      </Paper>

      <GameCarousel />
      
      <LobbyList />
      <GameFeed />
    </Box>
  );
} 