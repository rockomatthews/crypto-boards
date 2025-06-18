'use client';

import { Container, Box } from '@mui/material';
import { Profile } from '@/components/Profile';
import { FriendsList } from '@/components/FriendsList';

export default function ProfilePage() {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 4 }}>
        <Box>
          <Profile />
        </Box>
        <Box>
          <FriendsList />
        </Box>
      </Box>
    </Container>
  );
} 