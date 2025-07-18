'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { 
  Button, 
  Menu, 
  MenuItem, 
  ListItemIcon, 
  ListItemText, 
  Divider,
  Typography,
  Box,
  useMediaQuery,
  useTheme
} from '@mui/material';
import { 
  AccountBalanceWallet as WalletIcon,
  Person as PersonIcon,
  ContentCopy as CopyIcon,
  Logout as LogoutIcon,
  ExpandMore as ExpandMoreIcon
} from '@mui/icons-material';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useRouter } from 'next/navigation';

export default function CustomWalletButton() {
  const { publicKey, disconnect, wallet } = useWallet();
  const { setVisible } = useWalletModal();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    if (!publicKey) {
      setVisible(true);
    } else {
      setAnchorEl(event.currentTarget);
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleProfile = () => {
    router.push('/profile');
    handleClose();
  };

  const handleCopyAddress = async () => {
    if (publicKey) {
      await navigator.clipboard.writeText(publicKey.toString());
      // You could add a toast notification here
    }
    handleClose();
  };

  const handleDisconnect = () => {
    disconnect();
    handleClose();
  };

  const formatWalletAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  if (!publicKey) {
    return (
      <Button
        variant="contained"
        onClick={handleClick}
        startIcon={<WalletIcon />}
        sx={{
          background: 'linear-gradient(45deg, #9c27b0 30%, #ba68c8 90%)',
          minHeight: '48px',
          px: isMobile ? 2 : 3,
          fontSize: isMobile ? '0.875rem' : '1rem',
          '&:hover': {
            background: 'linear-gradient(45deg, #7b1fa2 30%, #9c27b0 90%)',
          },
          '&:active': {
            transform: 'scale(0.98)',
          },
          '&:focus': {
            outline: '2px solid #ba68c8',
            outlineOffset: '2px',
          }
        }}
      >
        {isMobile ? 'Connect' : 'Connect Wallet'}
      </Button>
    );
  }

  return (
    <>
      <Button
        variant="contained"
        onClick={handleClick}
        endIcon={<ExpandMoreIcon />}
        sx={{
          background: 'linear-gradient(45deg, #00e676 30%, #69f0ae 90%)',
          color: 'black',
          fontWeight: 'bold',
          minHeight: '48px',
          px: isMobile ? 2 : 3,
          fontSize: isMobile ? '0.875rem' : '1rem',
          '&:hover': {
            background: 'linear-gradient(45deg, #00c853 30%, #00e676 90%)',
          },
          '&:active': {
            transform: 'scale(0.98)',
          },
          '&:focus': {
            outline: '2px solid #00e676',
            outlineOffset: '2px',
          }
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {wallet?.adapter.icon && (
            <Image 
              src={wallet.adapter.icon} 
              alt={wallet.adapter.name}
              width={20}
              height={20}
              style={{ borderRadius: '50%' }}
            />
          )}
          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
            {isMobile ? formatWalletAddress(publicKey.toString()) : formatWalletAddress(publicKey.toString())}
          </Typography>
        </Box>
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        PaperProps={{
          sx: {
            mt: 1,
            minWidth: isMobile ? 250 : 200,
            '& .MuiMenuItem-root': {
              borderRadius: 1,
              mx: 1,
              my: 0.5,
              minHeight: isMobile ? '48px' : 'auto',
              py: isMobile ? 1.5 : 1,
            },
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {/* Profile Option */}
        <MenuItem onClick={handleProfile}>
          <ListItemIcon>
            <PersonIcon sx={{ color: 'primary.main' }} />
          </ListItemIcon>
          <ListItemText>
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
              Profile
            </Typography>
          </ListItemText>
        </MenuItem>

        <Divider sx={{ my: 1 }} />

        {/* Copy Address */}
        <MenuItem onClick={handleCopyAddress}>
          <ListItemIcon>
            <CopyIcon />
          </ListItemIcon>
          <ListItemText>
            <Typography variant="body2">
              Copy Address
            </Typography>
          </ListItemText>
        </MenuItem>

        {/* Wallet Info */}
        <MenuItem disabled>
          <ListItemText>
            <Typography variant="caption" color="text.secondary">
              {wallet?.adapter.name} Wallet
            </Typography>
            <Typography variant="caption" display="block" color="text.secondary">
              {formatWalletAddress(publicKey.toString())}
            </Typography>
          </ListItemText>
        </MenuItem>

        <Divider sx={{ my: 1 }} />

        {/* Disconnect */}
        <MenuItem onClick={handleDisconnect} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <LogoutIcon sx={{ color: 'error.main' }} />
          </ListItemIcon>
          <ListItemText>
            <Typography variant="body2">
              Disconnect
            </Typography>
          </ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
} 