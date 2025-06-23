'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions, Paper, Alert } from '@mui/material';

// Game types
type PieceType = 'red' | 'black' | null;
type Player = 'red' | 'black';

interface GamePiece {
  type: PieceType;
  isKing: boolean;
}

interface GameState {
  board: (GamePiece | null)[][];
  currentPlayer: Player;
  redPlayer: string | null;
  blackPlayer: string | null;
  gameStatus: 'waiting' | 'active' | 'finished';
  winner: Player | null;
  lastMove?: {
    from: [number, number];
    to: [number, number];
    capturedPieces?: [number, number][];
  };
}

interface CheckersBoardProps {
  gameId: string;
}

export const CheckersBoard: React.FC<CheckersBoardProps> = ({ gameId }) => {
  const { publicKey } = useWallet();
  const [gameState, setGameState] = useState<GameState>({
    board: initializeBoard(),
    currentPlayer: 'red',
    redPlayer: null,
    blackPlayer: null,
    gameStatus: 'waiting',
    winner: null,
  });
  
  const [selectedSquare, setSelectedSquare] = useState<[number, number] | null>(null);
  const [validMoves, setValidMoves] = useState<[number, number][]>([]);
  const [playerColor, setPlayerColor] = useState<Player | null>(null);
  const [gameEndDialog, setGameEndDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Initialize a standard checkers board
  function initializeBoard(): (GamePiece | null)[][] {
    const board: (GamePiece | null)[][] = Array(8).fill(null).map(() => Array(8).fill(null));
    
    // Place red pieces (bottom 3 rows)
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 8; col++) {
        if ((row + col) % 2 === 1) {
          board[row][col] = { type: 'red', isKing: false };
        }
      }
    }
    
    // Place black pieces (top 3 rows)
    for (let row = 5; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if ((row + col) % 2 === 1) {
          board[row][col] = { type: 'black', isKing: false };
        }
      }
    }
    
    return board;
  }

  // Fetch game state from API (like chat messages)
  const fetchGameState = useCallback(async () => {
    try {
      const response = await fetch(`/api/games/${gameId}/state`);
      if (response.ok) {
        const data = await response.json();
        if (data.currentState) {
          setGameState(data.currentState);
          
          // Determine player color based on game players
          if (publicKey) {
            const gameResponse = await fetch(`/api/games/${gameId}`);
            if (gameResponse.ok) {
              const gameData = await gameResponse.json();
              const walletAddress = publicKey.toString();
              
              if (gameData.players && gameData.players.length >= 2) {
                // First player = red, second player = black
                if (gameData.players[0].wallet_address === walletAddress) {
                  setPlayerColor('red');
                } else if (gameData.players[1].wallet_address === walletAddress) {
                  setPlayerColor('black');
                }
              }
            }
          }
        }
      } else if (response.status === 404) {
        // Game state doesn't exist yet, try to join the game
        await joinGame();
      }
    } catch (error) {
      console.error('Error fetching game state:', error);
      setError('Failed to load game state');
    }
  }, [gameId, publicKey]);

  // Join game (similar to chat user creation)
  const joinGame = useCallback(async () => {
    if (!publicKey) return;
    
    try {
      // Get player ID first
      const playerResponse = await fetch('/api/chat/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: publicKey.toString() })
      });
      
      if (!playerResponse.ok) return;
      
      const walletAddress = publicKey.toString();
      
      // Check if we need to initialize game state
      const gameResponse = await fetch(`/api/games/${gameId}`);
      if (gameResponse.ok) {
        const gameData = await gameResponse.json();
        
        if (gameData.players && gameData.players.length >= 1) {
          const newState: GameState = {
            board: initializeBoard(),
            currentPlayer: 'red' as Player,
            redPlayer: gameData.players[0]?.wallet_address || null,
            blackPlayer: gameData.players[1]?.wallet_address || null,
            gameStatus: (gameData.players.length >= 2 ? 'active' : 'waiting') as 'waiting' | 'active' | 'finished',
            winner: null,
          };
          
          // Determine player color
          if (gameData.players[0]?.wallet_address === walletAddress) {
            setPlayerColor('red');
          } else if (gameData.players[1]?.wallet_address === walletAddress) {
            setPlayerColor('black');
          }
          
          setGameState(newState);
          
          // Initialize game state in database if not exists
          const stateResponse = await fetch(`/api/games/${gameId}/state`);
          if (!stateResponse.ok) {
            await saveGameState(newState);
          }
        }
      }
    } catch (error) {
      console.error('Error joining game:', error);
    }
  }, [gameId, publicKey]);

  // Save game state to API (like sending chat messages)
  const saveGameState = async (state: GameState) => {
    if (!publicKey) return;
    
    try {
      const response = await fetch(`/api/games/${gameId}/state`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newState: state,
          playerId: publicKey.toString(),
          move: state.lastMove
        })
      });
      
      if (!response.ok) {
        console.error('Failed to save game state');
      }
    } catch (error) {
      console.error('Error saving game state:', error);
    }
  };

  // Polling setup (same as chat)
  useEffect(() => {
    if (gameId && publicKey) {
      fetchGameState();
      
      // Poll for updates every 3 seconds (same as chat)
      const interval = setInterval(() => {
        fetchGameState();
      }, 3000);
      
      return () => clearInterval(interval);
    }
  }, [gameId, publicKey, fetchGameState]);

  // Initialize game on mount
  useEffect(() => {
    if (gameId && publicKey) {
      joinGame();
    }
  }, [gameId, publicKey, joinGame]);

  // Get valid moves for a piece
  const getValidMoves = (row: number, col: number, piece: GamePiece): [number, number][] => {
    const moves: [number, number][] = [];
    if (!piece) return moves;

    const directions = piece.isKing 
      ? [[-1, -1], [-1, 1], [1, -1], [1, 1]] // Kings can move in all directions
      : piece.type === 'red' 
        ? [[1, -1], [1, 1]] // Red moves down
        : [[-1, -1], [-1, 1]]; // Black moves up

    for (const [dr, dc] of directions) {
      const newRow = row + dr;
      const newCol = col + dc;
      
      // Check if destination is valid and empty
      if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8 && !gameState.board[newRow][newCol]) {
        moves.push([newRow, newCol]);
      }
      
      // Check for jumps
      const jumpRow = row + dr * 2;
      const jumpCol = col + dc * 2;
      
      if (jumpRow >= 0 && jumpRow < 8 && jumpCol >= 0 && jumpCol < 8) {
        const jumpedPiece = gameState.board[newRow][newCol];
        const destination = gameState.board[jumpRow][jumpCol];
        
        if (jumpedPiece && jumpedPiece.type !== piece.type && !destination) {
          moves.push([jumpRow, jumpCol]);
        }
      }
    }
    
    return moves;
  };

  // Handle square click
  const handleSquareClick = (row: number, col: number) => {
    if (gameState.gameStatus !== 'active') return;
    if (!playerColor || gameState.currentPlayer !== playerColor) return;
    if (loading) return;

    const piece = gameState.board[row][col];
    
    if (selectedSquare) {
      const [selectedRow, selectedCol] = selectedSquare;
      
      // Check if this is a valid move
      const isValidMove = validMoves.some(([r, c]) => r === row && c === col);
      
      if (isValidMove) {
        makeMove(selectedRow, selectedCol, row, col);
      }
      
      setSelectedSquare(null);
      setValidMoves([]);
    } else if (piece && piece.type === playerColor) {
      setSelectedSquare([row, col]);
      setValidMoves(getValidMoves(row, col, piece));
    }
  };

  // Make a move and save to database
  const makeMove = async (fromRow: number, fromCol: number, toRow: number, toCol: number) => {
    setLoading(true);
    
    const newBoard = gameState.board.map(row => [...row]);
    const piece = newBoard[fromRow][fromCol];
    
    if (!piece) {
      setLoading(false);
      return;
    }
    
    // Move piece
    newBoard[toRow][toCol] = piece;
    newBoard[fromRow][fromCol] = null;
    
    // Check for jump
    const jumpedRow = Math.floor((fromRow + toRow) / 2);
    const jumpedCol = Math.floor((fromCol + toCol) / 2);
    const capturedPieces: [number, number][] = [];
    
    if (Math.abs(toRow - fromRow) === 2) {
      newBoard[jumpedRow][jumpedCol] = null; // Remove jumped piece
      capturedPieces.push([jumpedRow, jumpedCol]);
    }
    
    // Check for king promotion
    if ((piece.type === 'red' && toRow === 7) || (piece.type === 'black' && toRow === 0)) {
      newBoard[toRow][toCol] = { ...piece, isKing: true };
    }
    
    // Check for winner
    const winner = checkWinner(newBoard);
    
    const newState: GameState = {
      ...gameState,
      board: newBoard,
      currentPlayer: gameState.currentPlayer === 'red' ? 'black' : 'red',
      gameStatus: winner ? 'finished' : 'active',
      winner,
      lastMove: {
        from: [fromRow, fromCol],
        to: [toRow, toCol],
        capturedPieces: capturedPieces.length > 0 ? capturedPieces : undefined
      }
    };
    
    setGameState(newState);
    await saveGameState(newState);
    
    if (winner) {
      setGameEndDialog(true);
    }
    
    setLoading(false);
  };

  // Check for winner
  const checkWinner = (board: (GamePiece | null)[][]): Player | null => {
    let redPieces = 0;
    let blackPieces = 0;
    
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece?.type === 'red') redPieces++;
        if (piece?.type === 'black') blackPieces++;
      }
    }
    
    if (redPieces === 0) return 'black';
    if (blackPieces === 0) return 'red';
    return null;
  };

  // Render square with classic checkerboard pattern
  const renderSquare = (row: number, col: number) => {
    const piece = gameState.board[row][col];
    const isSelected = selectedSquare && selectedSquare[0] === row && selectedSquare[1] === col;
    const isValidMove = validMoves.some(([r, c]) => r === row && c === col);
    const isDarkSquare = (row + col) % 2 === 1;
    const isLastMoveSquare = gameState.lastMove && 
      ((gameState.lastMove.from[0] === row && gameState.lastMove.from[1] === col) ||
       (gameState.lastMove.to[0] === row && gameState.lastMove.to[1] === col));
    
    return (
      <div
        key={`${row}-${col}`}
        className={`square ${isDarkSquare ? 'dark' : 'light'} ${isSelected ? 'selected' : ''} ${isValidMove ? 'valid-move' : ''} ${isLastMoveSquare ? 'last-move' : ''}`}
        onClick={() => handleSquareClick(row, col)}
      >
        {piece && (
          <div className={`piece ${piece.type} ${piece.isKing ? 'king' : ''}`}>
            {piece.isKing && '♔'}
          </div>
        )}
      </div>
    );
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
      {/* Game Info */}
      <Paper sx={{ p: 2, mb: 3, bgcolor: '#8B4513', color: 'white', borderRadius: 2 }}>
        <Typography variant="h4" align="center" gutterBottom sx={{ fontWeight: 'bold' }}>
          🏁 Classic Checkers 🏁
        </Typography>
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#FF6B6B' }}>
              🔴 Red Player
            </Typography>
            <Typography variant="body2">
              {gameState.redPlayer ? `${gameState.redPlayer.slice(0, 8)}...` : 'Waiting...'}
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#333' }}>
              ⚫ Black Player
            </Typography>
            <Typography variant="body2">
              {gameState.blackPlayer ? `${gameState.blackPlayer.slice(0, 8)}...` : 'Waiting...'}
            </Typography>
          </Box>
        </Box>
        
        {gameState.gameStatus === 'active' && (
          <Typography align="center" variant="h6" sx={{ 
            bgcolor: gameState.currentPlayer === 'red' ? '#FF6B6B' : '#333',
            color: 'white',
            p: 1,
            borderRadius: 1,
            fontWeight: 'bold'
          }}>
            {gameState.currentPlayer === playerColor ? "🎯 Your Turn!" : `${gameState.currentPlayer.toUpperCase()}'s Turn`}
            {loading && " (Making move...)"}
          </Typography>
        )}
        
        {gameState.gameStatus === 'waiting' && (
          <Box sx={{ textAlign: 'center' }}>
            <Typography gutterBottom sx={{ fontSize: '1.1rem' }}>
              ⏳ Waiting for players to join...
            </Typography>
            <Typography variant="body2">
              You are playing as: {playerColor ? playerColor.toUpperCase() : 'Not assigned'}
            </Typography>
          </Box>
        )}
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Classic Checkerboard */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
        <div className="checkers-board">
          {gameState.board.map((row, rowIndex) =>
            row.map((_, colIndex) => renderSquare(rowIndex, colIndex))
          )}
        </div>
      </Box>

      {/* Game Instructions */}
      <Paper sx={{ p: 2, bgcolor: '#f5f5f5', borderRadius: 2 }}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', color: '#8B4513' }}>
          📋 How to Play:
        </Typography>
        <Typography variant="body2" component="div">
          • Click on your {playerColor} piece to select it<br/>
          • Green highlighted squares show valid moves<br/>
          • Jump over opponent pieces to capture them<br/>
          • Reach the opposite end to become a King ♔<br/>
          • Capture all opponent pieces to win!
        </Typography>
        {gameState.lastMove && (
          <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
            Last move: ({gameState.lastMove.from[0]},{gameState.lastMove.from[1]}) → ({gameState.lastMove.to[0]},{gameState.lastMove.to[1]})
          </Typography>
        )}
      </Paper>

      {/* Game End Dialog */}
      <Dialog open={gameEndDialog} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ textAlign: 'center', fontSize: '1.8rem', fontWeight: 'bold' }}>
          🎉 Game Over! 🎉
        </DialogTitle>
        <DialogContent>
          <Typography variant="h4" align="center" sx={{ 
            color: gameState.winner === 'red' ? '#FF6B6B' : '#333',
            fontWeight: 'bold',
            mb: 2
          }}>
            {gameState.winner?.toUpperCase()} WINS!
          </Typography>
          {gameState.winner === playerColor && (
            <Typography align="center" sx={{ 
              mt: 2, 
              color: 'success.main', 
              fontSize: '1.2rem',
              fontWeight: 'bold'
            }}>
              🏆 Congratulations! You are the champion! 🏆
            </Typography>
          )}
          {gameState.winner !== playerColor && playerColor && (
            <Typography align="center" sx={{ 
              mt: 2, 
              color: 'error.main', 
              fontSize: '1.1rem'
            }}>
              Better luck next time! 💪
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center' }}>
          <Button 
            onClick={() => setGameEndDialog(false)}
            variant="contained"
            sx={{ 
              bgcolor: '#8B4513', 
              color: 'white',
              fontWeight: 'bold',
              '&:hover': { bgcolor: '#654321' }
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}; 