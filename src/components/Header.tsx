'use client';
import React from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Button from '@mui/material/Button';
import PersonIcon from '@mui/icons-material/Person';
import ChatIcon from '@mui/icons-material/Chat';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import Image from 'next/image';

interface HeaderProps {
  onChatToggle?: () => void;
}

export default function Header({ onChatToggle }: HeaderProps = {}) {
  const { publicKey } = useWallet();

  return (
    <AppBar position="static" color="transparent" elevation={0} sx={{ borderBottom: '1px solid #222' }}>
      <Toolbar sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
          <Image
            src="/logo.png"
            alt="Crypto Boards"
            width={50}
            height={50}
            style={{ cursor: 'pointer' }}
          />
        </Link>
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
          {publicKey && (
            <Button
              variant="contained"
              color="primary"
              size="large"
              startIcon={<ChatIcon />}
              onClick={onChatToggle}
              sx={{ 
                ml: 2,
                px: 3,
                py: 1.5,
                fontSize: '1.1rem',
                fontWeight: 'bold',
                background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
                '&:hover': {
                  background: 'linear-gradient(45deg, #1976D2 30%, #0288D1 90%)',
                }
              }}
            >
              Community Chat
            </Button>
          )}
        </div>
      </Toolbar>

    </AppBar>
  );
} 