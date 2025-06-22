'use client';
import React from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Link from 'next/link';
import Image from 'next/image';
import CustomWalletButton from './CustomWalletButton';

export default function Header() {
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
          <CustomWalletButton />
        </div>
      </Toolbar>
    </AppBar>
  );
} 