'use client';

import React from 'react';
import { Fab, Badge } from '@mui/material';
import { Chat as ChatIcon, Close as CloseIcon } from '@mui/icons-material';
import { useWallet } from '@solana/wallet-adapter-react';

interface FloatingChatButtonProps {
  isOpen: boolean;
  onClick: () => void;
  unreadCount?: number;
}

export default function FloatingChatButton({ 
  isOpen, 
  onClick, 
  unreadCount = 0 
}: FloatingChatButtonProps) {
  const { publicKey } = useWallet();

  // Don't show the button if wallet is not connected
  if (!publicKey) return null;

  return (
    <>
      {/* Invisible sticky footer to ensure proper spacing */}
      <div style={{ height: '80px', width: '100%' }} />
      
      {/* Floating Chat Button */}
      <Fab
        color="primary"
        size="large"
        onClick={onClick}
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 1300,
          width: 64,
          height: 64,
          background: isOpen 
            ? 'linear-gradient(45deg, #f44336 30%, #ff5722 90%)'
            : 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
          color: 'white',
          boxShadow: '0 8px 25px rgba(0,0,0,0.3)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          '&:hover': {
            background: isOpen
              ? 'linear-gradient(45deg, #d32f2f 30%, #f57c00 90%)'
              : 'linear-gradient(45deg, #1976D2 30%, #0288D1 90%)',
            transform: isOpen ? 'rotate(180deg) scale(1.1)' : 'scale(1.1)',
            boxShadow: '0 12px 35px rgba(0,0,0,0.4)',
          },
          '&::before': {
            content: '""',
            position: 'absolute',
            top: -2,
            left: -2,
            right: -2,
            bottom: -2,
            background: 'linear-gradient(45deg, rgba(255,255,255,0.2), rgba(255,255,255,0.1))',
            borderRadius: '50%',
            zIndex: -1,
          }
        }}
      >
        <Badge 
          badgeContent={unreadCount} 
          color="error"
          sx={{
            '& .MuiBadge-badge': {
              backgroundColor: '#ff4444',
              color: 'white',
              fontWeight: 'bold',
              fontSize: '0.75rem',
              minWidth: '20px',
              height: '20px',
              top: 8,
              right: 8,
            }
          }}
        >
          {isOpen ? (
            <CloseIcon sx={{ fontSize: 28 }} />
          ) : (
            <ChatIcon sx={{ fontSize: 28 }} />
          )}
        </Badge>
      </Fab>
    </>
  );
} 