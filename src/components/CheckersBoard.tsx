'use client';

import { FC, useState, useCallback, useEffect, useRef } from 'react';
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
  playerColor?: 'black' | 'white'; // Which color this player is playing
}

interface GameState {
  board: BoardState;
  currentTurn: 'black' | 'white';
  selectedPiece: Position | null;
  validMoves: Position[];
  lastMove: { from: Position; to: Position } | null;
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
  currentPlayer,
  isMultiplayer = false,
  playerColor = 'white' // Default to white for single player
}) => {
  const [board, setBoard] = useState<BoardState>(initializeBoard());
  const [currentTurn, setCurrentTurn] = useState<'black' | 'white'>('black');
  const [selectedPiece, setSelectedPiece] = useState<Position | null>(null);
  const [validMoves, setValidMoves] = useState<Position[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<'black' | 'white' | null>(null);
  const lastUpdatedRef = useRef<string | null>(null);

  // Fetch game state from server
  const fetchGameState = useCallback(async () => {
    if (!isMultiplayer || !gameId) return;

    try {
      const response = await fetch(`/api/games/${gameId}`);
      if (response.ok) {
        const data = await response.json();
        const gameState = data.currentState as GameState;
        
        // Only update if the state has changed
        if (data.lastUpdated !== lastUpdatedRef.current) {
          setBoard(gameState?.board || initializeBoard());
          setCurrentTurn(gameState?.currentTurn || 'black');
          lastUpdatedRef.current = data.lastUpdated;
          
          // Clear local selection state when receiving updates from server
          setSelectedPiece(null);
          setValidMoves([]);
          
          // Check for game over
          checkGameOver(gameState?.board || initializeBoard());
        }
      }
    } catch (error) {
      console.error('Error fetching game state:', error);
    }
  }, [gameId, isMultiplayer]);

  // Send move to server
  const sendMoveToServer = useCallback(async (from: Position, to: Position, newBoard: BoardState, newTurn: 'black' | 'white') => {
    if (!isMultiplayer || !gameId || !currentPlayer) return;

    try {
      const newState: GameState = {
        board: newBoard,
        currentTurn: newTurn,
        selectedPiece: null,
        validMoves: [],
        lastMove: { from, to }
      };

      const response = await fetch(`/api/games/${gameId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          newState,
          playerId: currentPlayer.id
        }),
      });

      if (!response.ok) {
        console.error('Failed to send move to server');
      }
    } catch (error) {
      console.error('Error sending move to server:', error);
    }
  }, [gameId, isMultiplayer, currentPlayer]);

  // Set up polling for multiplayer games
  useEffect(() => {
    if (isMultiplayer && gameId) {
      fetchGameState(); // Initial fetch
      
      // Poll for updates every 2 seconds
      const interval = setInterval(fetchGameState, 2000);
      return () => clearInterval(interval);
    }
  }, [isMultiplayer, gameId, fetchGameState]);

  // Determine if board should be flipped for this player
  const shouldFlipBoard = isMultiplayer && playerColor === 'black';

  // Helper function to get actual board coordinates from display coordinates
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

    // Convert display coordinates to actual board coordinates
    const { row, col } = getActualCoords(displayRow, displayCol);
    const piece = board[row][col];
    
    // In multiplayer, only allow moves if it's the player's turn and their piece
    if (isMultiplayer) {
      if (currentTurn !== playerColor) return; // Not this player's turn
      
      const isPlayerPiece = piece && piece !== 'empty' && piece.includes(playerColor);
      
      if (piece && piece !== 'empty' && !isPlayerPiece) return; // Can't select opponent's piece
    } else {
      // Single player mode - check current turn
      const isCurrentPlayerPiece = piece && piece !== 'empty' &&
        ((currentTurn === 'black' && piece.includes('black')) ||
         (currentTurn === 'white' && piece.includes('white')));
      
      if (piece && piece !== 'empty' && !isCurrentPlayerPiece) return;
    }

    // If clicking on current player's piece, select it
    if (piece && piece !== 'empty' && ((isMultiplayer && piece.includes(playerColor)) || 
                  (!isMultiplayer && piece.includes(currentTurn)))) {
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
    
    if (!piece || piece === 'empty') return;

    // Move the piece
    newBoard[to.row][to.col] = piece;
    newBoard[from.row][from.col] = 'empty';

    // Check if it's a capture move
    const capturedRow = (from.row + to.row) / 2;
    const capturedCol = (from.col + to.col) / 2;
    const isCapture = Math.abs(from.row - to.row) === 2;

    if (isCapture) {
      newBoard[capturedRow][capturedCol] = 'empty';
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
      // Don't switch turns or send to server yet
    } else {
      // Switch turns
      const newTurn = currentTurn === 'black' ? 'white' : 'black';
      setCurrentTurn(newTurn);
      checkGameOver(newBoard);
      
      // Send move to server in multiplayer mode
      if (isMultiplayer && gameId) {
        sendMoveToServer(from, to, newBoard, newTurn);
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

  // Create display board (potentially flipped)
  const displayBoard = Array(8).fill(null).map((_, row) =>
    Array(8).fill(null).map((_, col) => {
      const { row: actualRow, col: actualCol } = getActualCoords(row, col);
      return board[actualRow][actualCol];
    })
  );

  // Get current turn display text
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
            // Check if this square is selected (need to convert to actual coordinates)
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