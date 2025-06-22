'use client';
import React from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Button from '@mui/material/Button';
import PersonIcon from '@mui/icons-material/Person';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import Image from 'next/image';

export default function Header() {
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
        </div>
      </Toolbar>

    </AppBar>
  );
} 