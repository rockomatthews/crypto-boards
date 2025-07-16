'use client';

import { useParams } from 'next/navigation';
import { Box } from '@mui/material';
import BattleshipBoard from '../../../components/BattleshipBoard';

export default function BattleshipGamePage() {
  const params = useParams();
  const gameId = params.id as string;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <BattleshipBoard gameId={gameId} />
    </Box>
  );
}