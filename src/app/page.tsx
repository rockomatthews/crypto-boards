import GameCarousel from '../components/GameCarousel';
import { LobbyList } from '../components/LobbyList';
import { GameFeed } from '../components/GameFeed';
import { Box, Typography } from '@mui/material';

export default function Home() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#000000' }}>
      {/* Cosmic Hero Section */}
      <Box sx={{ 
        position: 'relative',
        minHeight: '60vh',
        background: `
          url('/images/cosmic-background.jpg') center/cover no-repeat,
          radial-gradient(ellipse at center, rgba(255,0,255,0.3) 0%, rgba(138,43,226,0.4) 40%, rgba(25,25,112,0.8) 70%, rgba(0,0,0,0.9) 100%),
          linear-gradient(45deg, #1a0033 0%, #330066 25%, #0d1421 50%, #2d1b69 75%, #000000 100%)
        `,
        backgroundSize: 'cover, 400% 400%, 400% 400%',
        backgroundBlendMode: 'overlay, normal, normal',
        animation: 'cosmicPulse 8s ease-in-out infinite',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
        p: 4,
        mb: 4,
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `
            radial-gradient(2px 2px at 20px 30px, rgba(255,255,255,0.8), transparent),
            radial-gradient(2px 2px at 40px 70px, rgba(255,255,255,0.6), transparent),
            radial-gradient(1px 1px at 90px 40px, rgba(255,255,255,0.9), transparent),
            radial-gradient(1px 1px at 130px 80px, rgba(255,255,255,0.7), transparent),
            radial-gradient(2px 2px at 160px 30px, rgba(255,255,255,0.8), transparent)
          `,
          backgroundRepeat: 'repeat',
          backgroundSize: '200px 100px',
          animation: 'stars 20s linear infinite',
          zIndex: 1,
        }
      }}>
        <Typography 
          variant="h1" 
          component="h1" 
          sx={{ 
            fontFamily: '"Bangers", cursive',
            fontSize: { xs: '3rem', sm: '4rem', md: '6rem', lg: '7rem' },
            fontWeight: 'normal',
            color: '#ffffff',
            textShadow: `
              0 0 10px rgba(0,255,255,0.8),
              0 0 20px rgba(255,0,255,0.6),
              0 0 30px rgba(0,255,255,0.4),
              3px 3px 0 rgba(0,0,0,0.8),
              -1px -1px 0 rgba(0,0,0,0.8),
              1px -1px 0 rgba(0,0,0,0.8),
              -1px 1px 0 rgba(0,0,0,0.8)
            `,
            animation: 'textGlow 3s ease-in-out infinite',
            mb: 2,
            position: 'relative',
            zIndex: 2,
            letterSpacing: '0.1em',
            transform: 'perspective(500px) rotateX(5deg)',
          }}
        >
          SOL BOARD GAMES
        </Typography>
        
        <Typography 
          variant="h4" 
          component="h2"
          sx={{ 
            fontFamily: '"Bangers", cursive',
            fontSize: { xs: '1.2rem', sm: '1.5rem', md: '2rem', lg: '2.5rem' },
            fontWeight: 'normal',
            color: '#00ffff',
            textShadow: `
              0 0 5px rgba(255,0,255,0.8),
              0 0 10px rgba(0,255,255,0.6),
              2px 2px 0 rgba(0,0,0,0.8),
              -1px -1px 0 rgba(0,0,0,0.8)
            `,
            mb: 3,
            position: 'relative',
            zIndex: 2,
            letterSpacing: '0.05em',
            opacity: 0.95,
            animation: 'float 4s ease-in-out infinite',
          }}
        >
          CLASSIC BOARD GAMES FOR GAMBLING CRYPTO
        </Typography>

        <Typography 
          variant="h6" 
          sx={{ 
            fontFamily: '"Roboto", sans-serif',
            fontSize: { xs: '0.9rem', sm: '1rem', md: '1.1rem' },
            color: '#ffffff',
            textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
            opacity: 0.9,
            position: 'relative',
            zIndex: 2,
            maxWidth: '600px',
            mx: 'auto'
          }}
        >
          Real SOL betting • Live stats • Global chat • 15-min games
        </Typography>
      </Box>

      <GameCarousel />
      
      <LobbyList />
      <GameFeed />
    </Box>
  );
} 