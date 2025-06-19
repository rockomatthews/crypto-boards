'use client';

import { FC, useState, useCallback } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { CheckersSquare } from './CheckersSquare';

export type PieceType = 'black' | 'white' | 'black-king' | 'white-king' | null;
export type BoardState = PieceType[][];

interface Position {
  row: number;
  col: number;
}

interface CheckersBoardProps {
  gameId?: string;
  currentPlayer?: {
    id: string;
    username: string;
    wallet_address: string;
    game_status: string;
  };
  isMultiplayer?: boolean;
}

const initializeBoard = (): BoardState => {
  const board: BoardState = Array(8).fill(null).map(() => Array(8).fill(null));
  
  // Place black pieces (top 3 rows)
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2 === 1) {
        board[row][col] = 'black';
      }
    }
  }
  
  // Place white pieces (bottom 3 rows)
  for (let row = 5; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2 === 1) {
        board[row][col] = 'white';
      }
    }
  }
  
  return board;
};

export const CheckersBoard: FC<CheckersBoardProps> = () => {
  // TODO: Use gameId, currentPlayer, and isMultiplayer props for multiplayer functionality in the future

  const [board, setBoard] = useState<BoardState>(initializeBoard());
  const [currentPlayer, setCurrentPlayer] = useState<'black' | 'white'>('black');
  const [selectedPiece, setSelectedPiece] = useState<Position | null>(null);
  const [validMoves, setValidMoves] = useState<Position[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<'black' | 'white' | null>(null);

  const getValidMoves = useCallback((row: number, col: number): Position[] => {
    const piece = board[row][col];
    if (!piece) return [];

    const moves: Position[] = [];
    const isKing = piece.includes('king');
    const isBlack = piece.includes('black');

    // Define possible directions based on piece type
    const directions = isKing 
      ? [[-1, -1], [-1, 1], [1, -1], [1, 1]] // Kings can move in all 4 directions
      : isBlack 
        ? [[1, -1], [1, 1]] // Black pieces move down
        : [[-1, -1], [-1, 1]]; // White pieces move up

    // Check regular moves
    for (const [dRow, dCol] of directions) {
      const newRow = row + dRow;
      const newCol = col + dCol;
      
      if (isValidPosition(newRow, newCol) && board[newRow][newCol] === null) {
        moves.push({ row: newRow, col: newCol });
      }
    }

    // Check capture moves
    for (const [dRow, dCol] of directions) {
      const jumpRow = row + dRow * 2;
      const jumpCol = col + dCol * 2;
      const middleRow = row + dRow;
      const middleCol = col + dCol;
      
      if (isValidPosition(jumpRow, jumpCol) && 
          board[jumpRow][jumpCol] === null &&
          board[middleRow][middleCol] !== null &&
          board[middleRow][middleCol] !== piece &&
          !board[middleRow][middleCol]?.includes(isBlack ? 'black' : 'white')) {
        moves.push({ row: jumpRow, col: jumpCol });
      }
    }

    return moves;
  }, [board]);

  const isValidPosition = (row: number, col: number): boolean => {
    return row >= 0 && row < 8 && col >= 0 && col < 8;
  };

  const handleSquareClick = (row: number, col: number) => {
    if (gameOver) return;

    const piece = board[row][col];
    const isCurrentPlayerPiece = piece && 
      ((currentPlayer === 'black' && piece.includes('black')) ||
       (currentPlayer === 'white' && piece.includes('white')));

    // If clicking on current player's piece, select it
    if (isCurrentPlayerPiece) {
      setSelectedPiece({ row, col });
      const moves = getValidMoves(row, col);
      setValidMoves(moves);
      return;
    }

    // If clicking on a valid move position, make the move
    if (selectedPiece && validMoves.some(move => move.row === row && move.col === col)) {
      makeMove(selectedPiece, { row, col });
      setSelectedPiece(null);
      setValidMoves([]);
    }
  };

  const makeMove = (from: Position, to: Position) => {
    const newBoard = board.map(row => [...row]);
    const piece = newBoard[from.row][from.col];
    
    if (!piece) return;

    // Move the piece
    newBoard[to.row][to.col] = piece;
    newBoard[from.row][from.col] = null;

    // Check if it's a capture move
    const capturedRow = (from.row + to.row) / 2;
    const capturedCol = (from.col + to.col) / 2;
    const isCapture = Math.abs(from.row - to.row) === 2;

    if (isCapture) {
      newBoard[capturedRow][capturedCol] = null;
    }

    // Check for king promotion
    if (piece === 'black' && to.row === 7) {
      newBoard[to.row][to.col] = 'black-king';
    } else if (piece === 'white' && to.row === 0) {
      newBoard[to.row][to.col] = 'white-king';
    }

    setBoard(newBoard);

    // Check for additional captures
    const additionalCaptures = getCaptureMoves(to.row, to.col, newBoard);
    if (additionalCaptures.length > 0 && isCapture) {
      // Continue turn for multiple captures
      setSelectedPiece(to);
      setValidMoves(additionalCaptures);
    } else {
      // Switch turns
      setCurrentPlayer(currentPlayer === 'black' ? 'white' : 'black');
      checkGameOver(newBoard);
    }
  };

  const getCaptureMoves = (row: number, col: number, boardState: BoardState): Position[] => {
    const piece = boardState[row][col];
    if (!piece) return [];

    const moves: Position[] = [];
    const isKing = piece.includes('king');
    const isBlack = piece.includes('black');

    const directions = isKing 
      ? [[-1, -1], [-1, 1], [1, -1], [1, 1]]
      : isBlack 
        ? [[1, -1], [1, 1]]
        : [[-1, -1], [-1, 1]];

    for (const [dRow, dCol] of directions) {
      const jumpRow = row + dRow * 2;
      const jumpCol = col + dCol * 2;
      const middleRow = row + dRow;
      const middleCol = col + dCol;
      
      if (isValidPosition(jumpRow, jumpCol) && 
          boardState[jumpRow][jumpCol] === null &&
          boardState[middleRow][middleCol] !== null &&
          boardState[middleRow][middleCol] !== piece &&
          !boardState[middleRow][middleCol]?.includes(isBlack ? 'black' : 'white')) {
        moves.push({ row: jumpRow, col: jumpCol });
      }
    }

    return moves;
  };

  const checkGameOver = (boardState: BoardState) => {
    let blackPieces = 0;
    let whitePieces = 0;

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = boardState[row][col];
        if (piece?.includes('black')) blackPieces++;
        if (piece?.includes('white')) whitePieces++;
      }
    }

    if (blackPieces === 0) {
      setGameOver(true);
      setWinner('white');
    } else if (whitePieces === 0) {
      setGameOver(true);
      setWinner('black');
    }
  };

  const resetGame = () => {
    setBoard(initializeBoard());
    setCurrentPlayer('black');
    setSelectedPiece(null);
    setValidMoves([]);
    setGameOver(false);
    setWinner(null);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <Typography variant="h5" gutterBottom>
        {gameOver 
          ? `Game Over! ${winner ? winner.charAt(0).toUpperCase() + winner.slice(1) : ''} wins!`
          : `Current Player: ${currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1)}`
        }
      </Typography>
      
      <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(8, 1fr)', 
        gap: 0,
        border: '2px solid #333',
        width: 'fit-content'
      }}>
        {board.map((row, rowIndex) =>
          row.map((piece, colIndex) => (
            <CheckersSquare
              key={`${rowIndex}-${colIndex}`}
              piece={piece}
              isSelected={selectedPiece?.row === rowIndex && selectedPiece?.col === colIndex}
              isValidMove={validMoves.some(move => move.row === rowIndex && move.col === colIndex)}
              onClick={() => handleSquareClick(rowIndex, colIndex)}
              isDarkSquare={(rowIndex + colIndex) % 2 === 1}
            />
          ))
        )}
      </Box>

      <Button 
        variant="contained" 
        onClick={resetGame}
        sx={{ mt: 2 }}
      >
        New Game
      </Button>
    </Box>
  );
}; 