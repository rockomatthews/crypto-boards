'use client';

import { Typography, Box, Button, Card, CardContent } from '@mui/material';
import { useState } from 'react';
import { CreateGameModal } from '../../components/CreateGameModal';

export default function BattleshipLobby() {
  const [showCreateModal, setShowCreateModal] = useState(false);

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
      p: 4 
    }}>
      <Box sx={{ maxWidth: '1200px', margin: '0 auto', pt: 4 }}>
        {/* Hero Section */}
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <Typography 
            variant="h2" 
            sx={{ 
              fontWeight: 'bold', 
              color: 'white',
              mb: 2,
              textShadow: '2px 2px 4px rgba(0,0,0,0.5)'
            }}
          >
            ⚓ BATTLESHIP
          </Typography>
          <Typography 
            variant="h5" 
            sx={{ 
              color: 'rgba(255,255,255,0.9)', 
              mb: 4,
              maxWidth: '600px',
              margin: '0 auto 2rem auto'
            }}
          >
            Deploy your fleet and engage in naval warfare! Sink all enemy ships to claim victory and SOL rewards.
          </Typography>
          
          <Button
            variant="contained"
            size="large"
            onClick={() => setShowCreateModal(true)}
            sx={{
              fontSize: '1.2rem',
              py: 2,
              px: 4,
              background: 'linear-gradient(45deg, #ff6b6b 30%, #ee5a52 90%)',
              '&:hover': {
                background: 'linear-gradient(45deg, #ff5252 30%, #d32f2f 90%)',
              }
            }}
          >
            🚢 Create Battle
          </Button>
        </Box>

        {/* Game Info Cards */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 3, mb: 4 }}>
          <Card sx={{ bgcolor: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h6" sx={{ color: 'white', mb: 1 }}>
                🎯 Strategic Gameplay
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                Place your ships strategically and hunt down your opponent&apos;s fleet using skill and intuition.
              </Typography>
            </CardContent>
          </Card>

          <Card sx={{ bgcolor: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h6" sx={{ color: 'white', mb: 1 }}>
                ⚡ Real-Time Combat
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                Engage in turn-based naval combat with immediate feedback and dynamic gameplay.
              </Typography>
            </CardContent>
          </Card>

          <Card sx={{ bgcolor: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h6" sx={{ color: 'white', mb: 1 }}>
                💰 SOL Rewards
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                Win battles to earn SOL rewards from the entry fees. The victor takes nearly all!
              </Typography>
            </CardContent>
          </Card>
        </Box>

        {/* How to Play */}
        <Card sx={{ bgcolor: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', mb: 4 }}>
          <CardContent>
            <Typography variant="h6" sx={{ color: 'white', mb: 2 }}>
              🎮 How to Play
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
              <Box>
                <Typography variant="subtitle2" sx={{ color: '#4fc3f7', mb: 1 }}>
                  Setup Phase:
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', mb: 2 }}>
                  • Place 5 ships on your 10x10 grid<br/>
                  • Ships: Carrier(5), Battleship(4), Cruiser(3), Submarine(3), Destroyer(2)<br/>
                  • Ships cannot touch each other<br/>
                  • Click &quot;Ready&quot; when placement is complete
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" sx={{ color: '#4fc3f7', mb: 1 }}>
                  Battle Phase:
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                  • Take turns shooting at enemy grid<br/>
                  • Hit = Red, Miss = Blue<br/>
                  • Sink all enemy ships to win<br/>
                  • Winner takes the SOL pot!
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Fleet Overview */}
        <Card sx={{ bgcolor: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }}>
          <CardContent>
            <Typography variant="h6" sx={{ color: 'white', mb: 2 }}>
              🚢 Your Fleet
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              {[
                { name: 'Carrier', length: 5, icon: '🛳️' },
                { name: 'Battleship', length: 4, icon: '⚔️' },
                { name: 'Cruiser', length: 3, icon: '🚤' },
                { name: 'Submarine', length: 3, icon: '🚤' },
                { name: 'Destroyer', length: 2, icon: '⛵' },
              ].map(ship => (
                <Box 
                  key={ship.name}
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    bgcolor: 'rgba(255,255,255,0.1)', 
                    p: 1, 
                    borderRadius: 1 
                  }}
                >
                  <Typography sx={{ color: 'white', mr: 1 }}>
                    {ship.icon} {ship.name} ({ship.length})
                  </Typography>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>
      </Box>

      <CreateGameModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </Box>
  );
}