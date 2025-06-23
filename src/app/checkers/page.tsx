'use client';

import { FC } from 'react';
import { Container, Typography, Paper } from '@mui/material';
import { CheckersBoard } from '@/components/CheckersBoard';

const CheckersPage: FC = () => {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h3" component="h1" gutterBottom align="center">
        Practice Checkers
      </Typography>
      <Paper elevation={3} sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
        <CheckersBoard gameId="practice-game" />
      </Paper>
    </Container>
  );
};

export default CheckersPage; 