'use client';

import { FC } from 'react';
import { Box } from '@mui/material';
import { PieceType } from './CheckersBoard';

interface CheckersSquareProps {
  piece: PieceType;
  isSelected: boolean;
  isValidMove: boolean;
  onClick: () => void;
  isDarkSquare: boolean;
}

export const CheckersSquare: FC<CheckersSquareProps> = ({
  piece,
  isSelected,
  isValidMove,
  onClick,
  isDarkSquare,
}) => {
  const getPieceColor = () => {
    if (!piece) return 'transparent';
    return piece.includes('black') ? '#000' : '#fff';
  };

  const getPieceBorder = () => {
    if (!piece) return 'none';
    return piece.includes('king') ? '3px solid #ffd700' : '2px solid #333';
  };

  const getSquareColor = () => {
    if (isSelected) return '#4caf50';
    if (isValidMove) return '#ff9800';
    return isDarkSquare ? '#8b4513' : '#f4d03f';
  };

  return (
    <Box
      onClick={onClick}
      sx={{
        width: 60,
        height: 60,
        backgroundColor: getSquareColor(),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        border: '1px solid #333',
        position: 'relative',
        '&:hover': {
          opacity: 0.8,
        },
      }}
    >
      {piece && (
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            backgroundColor: getPieceColor(),
            border: getPieceBorder(),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          {piece.includes('king') && (
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: piece.includes('black') ? '#fff' : '#000',
                border: '1px solid #333',
              }}
            />
          )}
        </Box>
      )}
      {isValidMove && !piece && (
        <Box
          sx={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 152, 0, 0.5)',
            border: '2px solid #ff9800',
          }}
        />
      )}
    </Box>
  );
}; 