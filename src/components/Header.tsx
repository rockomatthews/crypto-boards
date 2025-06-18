'use client';
import React, { useState } from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import PersonIcon from '@mui/icons-material/Person';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';

const GAMES = [
  { label: 'Checkers', value: 'checkers', maxPlayers: 2 },
  { label: 'Chess', value: 'chess', maxPlayers: 2 },
  { label: 'Go', value: 'go', maxPlayers: 2 },
  { label: 'Poker', value: 'poker', maxPlayers: 6 },
];

export default function Header() {
  const { publicKey } = useWallet();
  const [open, setOpen] = useState(false);
  const [selectedGame, setSelectedGame] = useState('checkers');
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [isPublic, setIsPublic] = useState(true);

  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  const handleGameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const game = GAMES.find(g => g.value === e.target.value);
    setSelectedGame(e.target.value);
    setMaxPlayers(game ? game.maxPlayers : 2);
  };

  const handleCreate = () => {
    // TODO: Implement game creation logic
    handleClose();
  };

  return (
    <AppBar position="static" color="transparent" elevation={0} sx={{ borderBottom: '1px solid #222' }}>
      <Toolbar sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: 1 }}>
          Crypto Boards
        </Typography>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {publicKey && (
            <Button
              component={Link}
              href="/profile"
              startIcon={<PersonIcon />}
              sx={{ color: 'text.primary' }}
            >
              Profile
            </Button>
          )}
          <WalletMultiButton />
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddCircleIcon />}
            onClick={handleOpen}
            sx={{ ml: 2 }}
          >
            Create Game
          </Button>
        </div>
      </Toolbar>
      <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
        <DialogTitle>Create a Game</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            select
            label="Game"
            value={selectedGame}
            onChange={handleGameChange}
            fullWidth
          >
            {GAMES.map(game => (
              <MenuItem key={game.value} value={game.value}>
                {game.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Max Players"
            type="number"
            value={maxPlayers}
            onChange={e => setMaxPlayers(Number(e.target.value))}
            inputProps={{ min: 2, max: GAMES.find(g => g.value === selectedGame)?.maxPlayers || 2 }}
            fullWidth
            disabled={GAMES.find(g => g.value === selectedGame)?.maxPlayers === 2}
          />
          <FormControlLabel
            control={<Switch checked={isPublic} onChange={e => setIsPublic(e.target.checked)} />}
            label={isPublic ? 'Public' : 'Private'}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={handleCreate} variant="contained" color="primary">Create</Button>
        </DialogActions>
      </Dialog>
    </AppBar>
  );
} 