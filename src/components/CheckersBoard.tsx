'use client';

import { FC, useState, useCallback, useEffect } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { CheckersSquare } from './CheckersSquare';

export type PieceType = 'black' | 'white' | 'black-king' | 'white-king' | 'empty';
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
  playerColor?: 'black' | 'white';
}

const initializeBoard = (): BoardState => {
  const board: BoardState = Array(8).fill(null).map(() => Array(8).fill('empty'));
  
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

export const CheckersBoard: FC<CheckersBoardProps> = ({ 
  gameId, 
  isMultiplayer = false,
  playerColor = 'white'
}) => {
  const [board, setBoard] = useState<BoardState>(initializeBoard());
  const [currentTurn, setCurrentTurn] = useState<'black' | 'white'>('black');
  const [selectedPiece, setSelectedPiece] = useState<Position | null>(null);
  const [validMoves, setValidMoves] = useState<Position[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<'black' | 'white' | null>(null);

  // Real-time sync using localStorage (for local testing) and storage events
  useEffect(() => {
    if (!isMultiplayer || !gameId) return;

    const storageKey = `game-state-${gameId}`;

    // Listen for changes from other browser tabs/windows
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === storageKey && e.newValue) {
        try {
          const gameState = JSON.parse(e.newValue);
          setBoard(gameState.board);
          setCurrentTurn(gameState.currentTurn);
          setSelectedPiece(null);
          setValidMoves([]);
          checkGameOver(gameState.board);
          console.log('Game state synced from other player');
        } catch (error) {
          console.error('Error parsing game state:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Load initial state if exists
    const savedState = localStorage.getItem(storageKey);
    if (savedState) {
      try {
        const gameState = JSON.parse(savedState);
        setBoard(gameState.board);
        setCurrentTurn(gameState.currentTurn);
        checkGameOver(gameState.board);
        console.log('Loaded existing game state');
      } catch (error) {
        console.error('Error loading saved game state:', error);
      }
    }

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [isMultiplayer, gameId]);

  // Save game state for other players
  const syncGameState = useCallback((gameState: { board: BoardState; currentTurn: 'black' | 'white'; lastMove: { from: Position; to: Position } | null }) => {
    if (!isMultiplayer || !gameId) return;

    const storageKey = `game-state-${gameId}`;
    localStorage.setItem(storageKey, JSON.stringify(gameState));
    console.log('Game state saved for sync');
  }, [isMultiplayer, gameId]);

  const shouldFlipBoard = isMultiplayer && playerColor === 'black';

  const getActualCoords = (displayRow: number, displayCol: number) => {
    if (shouldFlipBoard) {
      return { row: 7 - displayRow, col: 7 - displayCol };
    }
    return { row: displayRow, col: displayCol };
  };

  const getValidMoves = useCallback((row: number, col: number): Position[] => {
    const piece = board[row][col];
    if (!piece || piece === 'empty') return [];

    const moves: Position[] = [];
    const isKing = piece.includes('king');
    const isBlack = piece.includes('black');

    const directions = isKing 
      ? [[-1, -1], [-1, 1], [1, -1], [1, 1]]
      : isBlack 
        ? [[1, -1], [1, 1]]
        : [[-1, -1], [-1, 1]];

    // Check regular moves
    for (const [dRow, dCol] of directions) {
      const newRow = row + dRow;
      const newCol = col + dCol;
      
      if (isValidPosition(newRow, newCol) && board[newRow][newCol] === 'empty') {
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
          board[jumpRow][jumpCol] === 'empty' &&
          board[middleRow][middleCol] !== 'empty' &&
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

  const handleSquareClick = (displayRow: number, displayCol: number) => {
    if (gameOver) return;

    const { row, col } = getActualCoords(displayRow, displayCol);
    const piece = board[row][col];
    
    if (isMultiplayer) {
      if (currentTurn !== playerColor) return;
      
      const isPlayerPiece = piece && piece !== 'empty' && piece.includes(playerColor);
      
      if (piece && piece !== 'empty' && !isPlayerPiece) return;
    } else {
      const isCurrentPlayerPiece = piece && piece !== 'empty' &&
        ((currentTurn === 'black' && piece.includes('black')) ||
         (currentTurn === 'white' && piece.includes('white')));
      
      if (piece && piece !== 'empty' && !isCurrentPlayerPiece) return;
    }

    if (piece && piece !== 'empty' && ((isMultiplayer && piece.includes(playerColor)) || 
                  (!isMultiplayer && piece.includes(currentTurn)))) {
      setSelectedPiece({ row, col });
      const moves = getValidMoves(row, col);
      setValidMoves(moves);
      return;
    }

    if (selectedPiece && validMoves.some(move => move.row === row && move.col === col)) {
      makeMove(selectedPiece, { row, col });
      setSelectedPiece(null);
      setValidMoves([]);
    }
  };

  const makeMove = (from: Position, to: Position) => {
    const newBoard = board.map(row => [...row]);
    const piece = newBoard[from.row][from.col];
    
    if (!piece || piece === 'empty') return;

    newBoard[to.row][to.col] = piece;
    newBoard[from.row][from.col] = 'empty';

    const capturedRow = (from.row + to.row) / 2;
    const capturedCol = (from.col + to.col) / 2;
    const isCapture = Math.abs(from.row - to.row) === 2;

    if (isCapture) {
      newBoard[capturedRow][capturedCol] = 'empty';
    }

    if (piece === 'black' && to.row === 7) {
      newBoard[to.row][to.col] = 'black-king';
    } else if (piece === 'white' && to.row === 0) {
      newBoard[to.row][to.col] = 'white-king';
    }

    setBoard(newBoard);

    const additionalCaptures = getCaptureMoves(to.row, to.col, newBoard);
    if (additionalCaptures.length > 0 && isCapture) {
      setSelectedPiece(to);
      setValidMoves(additionalCaptures);
    } else {
      const newTurn = currentTurn === 'black' ? 'white' : 'black';
      setCurrentTurn(newTurn);
      checkGameOver(newBoard);
      
      // Sync game state in multiplayer mode
      if (isMultiplayer && gameId) {
        const gameState = {
          board: newBoard,
          currentTurn: newTurn as 'black' | 'white',
          lastMove: { from, to }
        };
        syncGameState(gameState);
      }
    }
  };

  const getCaptureMoves = (row: number, col: number, boardState: BoardState): Position[] => {
    const piece = boardState[row][col];
    if (!piece || piece === 'empty') return [];

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
          boardState[jumpRow][jumpCol] === 'empty' &&
          boardState[middleRow][middleCol] !== 'empty' &&
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
    setCurrentTurn('black');
    setSelectedPiece(null);
    setValidMoves([]);
    setGameOver(false);
    setWinner(null);
  };

  const displayBoard = Array(8).fill(null).map((_, row) =>
    Array(8).fill(null).map((_, col) => {
      const { row: actualRow, col: actualCol } = getActualCoords(row, col);
      return board[actualRow][actualCol];
    })
  );

  const getCurrentTurnText = () => {
    if (gameOver) {
      return `Game Over! ${winner ? winner.charAt(0).toUpperCase() + winner.slice(1) : ''} wins!`;
    }
    
    if (isMultiplayer) {
      const isMyTurn = currentTurn === playerColor;
      return `${isMyTurn ? 'Your' : "Opponent's"} Turn (${currentTurn.charAt(0).toUpperCase() + currentTurn.slice(1)})`;
    }
    
    return `Current Player: ${currentTurn.charAt(0).toUpperCase() + currentTurn.slice(1)}`;
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <Typography variant="h5" gutterBottom>
        {getCurrentTurnText()}
      </Typography>
      
      {isMultiplayer && (
        <Typography variant="body1" color="text.secondary">
          You are playing as {playerColor.charAt(0).toUpperCase() + playerColor.slice(1)}
          <Typography variant="caption" display="block" color="text.secondary">
            Open another browser tab to play as the opponent
          </Typography>
        </Typography>
      )}
      
      <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(8, 1fr)', 
        gap: 0,
        border: '2px solid #333',
        width: 'fit-content'
      }}>
        {displayBoard.map((row, rowIndex) =>
          row.map((piece, colIndex) => {
            const { row: actualRow, col: actualCol } = getActualCoords(rowIndex, colIndex);
            const isSelected = selectedPiece?.row === actualRow && selectedPiece?.col === actualCol;
            const isValidMove = validMoves.some(move => move.row === actualRow && move.col === actualCol);
            
            return (
              <CheckersSquare
                key={`${rowIndex}-${colIndex}`}
                piece={piece}
                isSelected={isSelected}
                isValidMove={isValidMove}
                onClick={() => handleSquareClick(rowIndex, colIndex)}
                isDarkSquare={(rowIndex + colIndex) % 2 === 1}
              />
            );
          })
        )}
      </Box>

      {!isMultiplayer && (
        <Button 
          variant="contained" 
          onClick={resetGame}
          sx={{ mt: 2 }}
        >
          New Game
        </Button>
      )}
    </Box>
  );
}; 