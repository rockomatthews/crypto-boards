'use client';

import React from 'react';
import { Box, Typography, Paper } from '@mui/material';
import { LobbyList } from '../../components/LobbyList';
import { CreateGameModal } from '../../components/CreateGameModal';

export default function StrategoPage() {
  const [modalOpen, setModalOpen] = React.useState(false);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#1a1a2e', py: 4 }}>
      <Box sx={{ maxWidth: 1200, mx: 'auto', px: 3 }}>
        {/* Header */}
        <Paper sx={{ 
          p: 4, 
          mb: 4, 
          bgcolor: '#2E4057', 
          color: 'white',
          textAlign: 'center',
          borderRadius: 3,
          background: 'linear-gradient(135deg, #2E4057, #1e2a3a)'
        }}>
          <Typography variant="h2" component="h1" gutterBottom sx={{ 
            fontWeight: 'bold',
            fontSize: { xs: '2rem', md: '3rem' }
          }}>
            🎖️ Stratego Battle Arena 🎖️
          </Typography>
          <Typography variant="h5" sx={{ 
            opacity: 0.9,
            mb: 2,
            fontSize: { xs: '1rem', md: '1.25rem' }
          }}>
            Master the Art of War & Strategy
          </Typography>
          <Typography variant="body1" sx={{ 
            maxWidth: 800, 
            mx: 'auto',
            opacity: 0.8,
            fontSize: { xs: '0.9rem', md: '1rem' }
          }}>
            Deploy your army, hide your flag, and outmaneuver your opponent in this classic game of military strategy. 
            Each piece has unique abilities - use them wisely to capture the enemy flag and claim victory!
          </Typography>
        </Paper>

        {/* Game Rules */}
        <Paper sx={{ 
          p: 3, 
          mb: 4, 
          bgcolor: 'rgba(46, 64, 87, 0.1)',
          borderRadius: 2
        }}>
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', color: '#2E4057' }}>
            📋 How to Play Stratego
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
            <Box>
              <Typography variant="h6" sx={{ color: '#2E4057', mb: 1 }}>⚔️ Objective</Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Capture your opponent&apos;s Flag or eliminate all their movable pieces
              </Typography>
              
              <Typography variant="h6" sx={{ color: '#2E4057', mb: 1 }}>🏴 Special Pieces</Typography>
              <Typography variant="body2" component="div">
                • <strong>Marshal (⭐):</strong> Highest rank, defeats all except Spy<br/>
                • <strong>Spy (🕵️):</strong> Can capture Marshal but loses to all others<br/>
                • <strong>Scout (👁️):</strong> Can move multiple spaces in straight lines<br/>
                • <strong>Miner (⛏️):</strong> Only piece that can defuse Bombs<br/>
                • <strong>Bomb (💣):</strong> Immovable, destroys any attacker except Miner<br/>
                • <strong>Flag (🏴):</strong> Immovable, must be protected at all costs
              </Typography>
            </Box>
            <Box>
              <Typography variant="h6" sx={{ color: '#2E4057', mb: 1 }}>🎯 Combat Rules</Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                When pieces battle, higher rank wins. Equal ranks destroy each other.
                All pieces are revealed after combat.
              </Typography>
              
              <Typography variant="h6" sx={{ color: '#2E4057', mb: 1 }}>🌊 Terrain</Typography>
              <Typography variant="body2">
                Lakes block movement - pieces cannot move through or stop on lake squares.
                Use them strategically to protect your flag and control the battlefield.
              </Typography>
            </Box>
          </Box>
        </Paper>

        {/* Lobby and Game Creation */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' }, gap: 4 }}>
          <Box>
            <Typography variant="h4" gutterBottom sx={{ color: '#2E4057', fontWeight: 'bold' }}>
              🏟️ Active Battles
            </Typography>
            <LobbyList />
          </Box>
          
          <Box>
            <Typography variant="h4" gutterBottom sx={{ color: '#2E4057', fontWeight: 'bold' }}>
              ⚡ Quick Start
            </Typography>
            <Paper sx={{ p: 3, bgcolor: 'rgba(46, 64, 87, 0.1)', borderRadius: 2 }}>
              <Typography variant="body1" sx={{ mb: 2, color: '#2E4057' }}>
                Ready to command your army? Create a new Stratego battle and challenge opponents worldwide!
              </Typography>
              <button 
                onClick={() => setModalOpen(true)}
                style={{
                  width: '100%',
                  padding: '12px 24px',
                  backgroundColor: '#2E4057',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1e2a3a'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#2E4057'}
              >
                🎖️ Create Battle
              </button>
            </Paper>
          </Box>
        </Box>
      </Box>

      <CreateGameModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </Box>
  );
}
