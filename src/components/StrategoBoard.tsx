'use client';

import React, { useState, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions, Paper, Alert } from '@mui/material';

// Game types
type PieceColor = 'red' | 'blue' | null;
type Player = 'red' | 'blue';

// Stratego piece ranks and types
type PieceRank = 
  | 'Marshal'      // 1 - Highest rank
  | 'General'      // 2 
  | 'Colonel'      // 3
  | 'Major'        // 4
  | 'Captain'      // 5
  | 'Lieutenant'   // 6
  | 'Sergeant'     // 7
  | 'Miner'        // 8 - Can defuse bombs
  | 'Scout'        // 9 - Can move multiple spaces
  | 'Spy'          // S - Can capture Marshal
  | 'Bomb'         // B - Immovable, destroys attackers
  | 'Flag';        // F - Immovable, win condition

interface StrategoPiece {
  color: PieceColor;
  rank: PieceRank;
  isRevealed: boolean; // Whether the piece has been revealed to opponent
  canMove: boolean;    // Bombs and Flags can't move
}

interface GameState {
  board: (StrategoPiece | null)[][];
  currentPlayer: Player;
  redPlayer: string | null;
  bluePlayer: string | null;
  gameStatus: 'setup' | 'waiting' | 'active' | 'finished';
  winner: Player | null;
  setupPhase: boolean; // True during initial piece placement
  lastMove?: {
    from: [number, number];
    to: [number, number];
    combat?: {
      attacker: StrategoPiece;
      defender: StrategoPiece;
      winner: 'attacker' | 'defender' | 'both_destroyed';
    };
  };
}

interface StrategoBoardProps {
  gameId: string;
}

// Lake positions on 10x10 board (4 squares in middle)
const LAKE_POSITIONS = [
  [4, 2], [4, 3], [5, 2], [5, 3],  // Left lake
  [4, 6], [4, 7], [5, 6], [5, 7]   // Right lake
];

// Piece rank values for combat (lower number = higher rank)
const RANK_VALUES: Record<PieceRank, number> = {
  'Marshal': 1,
  'General': 2,
  'Colonel': 3,
  'Major': 4,
  'Captain': 5,
  'Lieutenant': 6,
  'Sergeant': 7,
  'Miner': 8,
  'Scout': 9,
  'Spy': 10,
  'Bomb': 99,  // Special handling
  'Flag': 100  // Special handling
};


// Initialize empty 10x10 board
function createInitialBoard(): (StrategoPiece | null)[][] {
  return Array(10).fill(null).map(() => Array(10).fill(null));
}

// Check if position is a lake
function isLakePosition(row: number, col: number): boolean {
  return LAKE_POSITIONS.some(([lakeRow, lakeCol]) => lakeRow === row && lakeCol === col);
}

// Resolve combat between two pieces
function resolveCombat(attacker: StrategoPiece, defender: StrategoPiece): 'attacker' | 'defender' | 'both_destroyed' {
  // Special cases first
  if (defender.rank === 'Flag') return 'attacker'; // Capturing flag wins
  if (defender.rank === 'Bomb') {
    return attacker.rank === 'Miner' ? 'attacker' : 'defender'; // Only Miner can defuse bombs
  }
  if (attacker.rank === 'Spy' && defender.rank === 'Marshal') {
    return 'attacker'; // Spy can capture Marshal
  }
  if (attacker.rank === 'Bomb' || attacker.rank === 'Flag') {
    return 'defender'; // Bombs and Flags can't attack
  }

  // Normal rank comparison
  const attackerValue = RANK_VALUES[attacker.rank];
  const defenderValue = RANK_VALUES[defender.rank];
  
  if (attackerValue < defenderValue) return 'attacker';
  if (attackerValue > defenderValue) return 'defender';
  return 'both_destroyed'; // Equal ranks
}

export const StrategoBoard: React.FC<StrategoBoardProps> = ({ gameId }) => {
  const { publicKey } = useWallet();
  const [gameState, setGameState] = useState<GameState>(() => ({
    board: createInitialBoard(),
    currentPlayer: 'red',
    redPlayer: null,
    bluePlayer: null,
    gameStatus: 'setup',
    winner: null,
    setupPhase: true,
  }));
  
  const [selectedSquare, setSelectedSquare] = useState<[number, number] | null>(null);
  const [validMoves, setValidMoves] = useState<[number, number][]>([]);
  const [playerColor] = useState<Player | null>(null);
  const [gameEndDialog, setGameEndDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // For future use - keeping these for when we implement full features
  console.log('Game ID:', gameId); // Temporary to avoid linter error

  // Get valid moves for a piece
  const getValidMoves = useCallback((row: number, col: number, piece: StrategoPiece): [number, number][] => {
    const moves: [number, number][] = [];
    if (!piece || !piece.canMove) return moves;

    // Scout can move multiple spaces in straight lines
    if (piece.rank === 'Scout') {
      // Check all four directions
      const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      
      for (const [dr, dc] of directions) {
        for (let distance = 1; distance < 10; distance++) {
          const newRow = row + dr * distance;
          const newCol = col + dc * distance;
          
          if (newRow < 0 || newRow >= 10 || newCol < 0 || newCol >= 10) break;
          if (isLakePosition(newRow, newCol)) break;
          
          const targetPiece = gameState.board[newRow][newCol];
          if (targetPiece) {
            // Can attack enemy pieces
            if (targetPiece.color !== piece.color) {
              moves.push([newRow, newCol]);
            }
            break; // Can't move past any piece
          } else {
            moves.push([newRow, newCol]);
          }
        }
      }
    } else {
      // Regular pieces move one space
      const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      
      for (const [dr, dc] of directions) {
        const newRow = row + dr;
        const newCol = col + dc;
        
        if (newRow >= 0 && newRow < 10 && newCol >= 0 && newCol < 10) {
          if (isLakePosition(newRow, newCol)) continue;
          
          const targetPiece = gameState.board[newRow][newCol];
          if (!targetPiece || targetPiece.color !== piece.color) {
            moves.push([newRow, newCol]);
          }
        }
      }
    }
    
    return moves;
  }, [gameState.board]);

  // Check for winner
  const checkWinner = useCallback((board: (StrategoPiece | null)[][]): Player | null => {
    let redFlag = false;
    let blueFlag = false;
    let redMovablePieces = 0;
    let blueMovablePieces = 0;
    
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 10; col++) {
        const piece = board[row][col];
        if (piece) {
          if (piece.rank === 'Flag') {
            if (piece.color === 'red') redFlag = true;
            if (piece.color === 'blue') blueFlag = true;
          }
          if (piece.canMove) {
            if (piece.color === 'red') redMovablePieces++;
            if (piece.color === 'blue') blueMovablePieces++;
          }
        }
      }
    }
    
    // Win conditions
    if (!redFlag) return 'blue';      // Red flag captured
    if (!blueFlag) return 'red';      // Blue flag captured
    if (redMovablePieces === 0) return 'blue';  // Red has no movable pieces
    if (blueMovablePieces === 0) return 'red';  // Blue has no movable pieces
    
    return null;
  }, []);

  // Make a move with combat resolution
  const makeMove = useCallback(async (fromRow: number, fromCol: number, toRow: number, toCol: number) => {
    setLoading(true);
    
    const newBoard = gameState.board.map(row => [...row]);
    const attackingPiece = newBoard[fromRow][fromCol];
    const defendingPiece = newBoard[toRow][toCol];
    
    if (!attackingPiece || !publicKey) {
      setLoading(false);
      return;
    }
    
    let combatResult: {
      attacker: StrategoPiece;
      defender: StrategoPiece;
      winner: 'attacker' | 'defender' | 'both_destroyed';
    } | undefined = undefined;
    
    if (defendingPiece) {
      // Combat!
      const winner = resolveCombat(attackingPiece, defendingPiece);
      combatResult = {
        attacker: attackingPiece,
        defender: defendingPiece,
        winner
      };
      
      // Reveal both pieces after combat
      attackingPiece.isRevealed = true;
      defendingPiece.isRevealed = true;
      
      switch (winner) {
        case 'attacker':
          newBoard[toRow][toCol] = attackingPiece;
          newBoard[fromRow][fromCol] = null;
          console.log(`⚔️ ${attackingPiece.rank} defeats ${defendingPiece.rank}!`);
          break;
        case 'defender':
          newBoard[fromRow][fromCol] = null;
          console.log(`🛡️ ${defendingPiece.rank} defeats ${attackingPiece.rank}!`);
          break;
        case 'both_destroyed':
          newBoard[fromRow][fromCol] = null;
          newBoard[toRow][toCol] = null;
          console.log(`💥 ${attackingPiece.rank} and ${defendingPiece.rank} destroy each other!`);
          break;
      }
    } else {
      // Simple move
      newBoard[toRow][toCol] = attackingPiece;
      newBoard[fromRow][fromCol] = null;
    }
    
    // Check for winner
    const winner = checkWinner(newBoard);
    
    const newState: GameState = {
      ...gameState,
      board: newBoard,
      currentPlayer: gameState.currentPlayer === 'red' ? 'blue' : 'red',
      gameStatus: winner ? 'finished' : 'active',
      winner,
      lastMove: {
        from: [fromRow, fromCol],
        to: [toRow, toCol],
        combat: combatResult
      }
    };
    
    setGameState(newState);
    
    if (winner) {
      setGameEndDialog(true);
      console.log(`🏆 ${winner.toUpperCase()} WINS!`);
    }
    
    setLoading(false);
  }, [gameState, checkWinner, publicKey]);

  // Handle square click
  const handleSquareClick = useCallback((row: number, col: number) => {
    if (gameState.gameStatus !== 'active') return;
    if (!playerColor || gameState.currentPlayer !== playerColor) return;
    if (loading) return;
    if (isLakePosition(row, col)) return;

    const piece = gameState.board[row][col];
    
    if (selectedSquare) {
      const [selectedRow, selectedCol] = selectedSquare;
      const isValidMove = validMoves.some(([r, c]) => r === row && c === col);
      
      if (isValidMove) {
        makeMove(selectedRow, selectedCol, row, col);
      }
      
      setSelectedSquare(null);
      setValidMoves([]);
    } else if (piece && piece.color === playerColor && piece.canMove) {
      setSelectedSquare([row, col]);
      const moves = getValidMoves(row, col, piece);
      setValidMoves(moves);
    }
  }, [gameState.gameStatus, gameState.board, gameState.currentPlayer, playerColor, loading, selectedSquare, validMoves, makeMove, getValidMoves]);

  // Get symbol for piece rank
  const getPieceSymbol = (rank: PieceRank): string => {
    const symbols: Record<PieceRank, string> = {
      'Marshal': '⭐',
      'General': '🎖️',
      'Colonel': '🏅',
      'Major': '🎗️',
      'Captain': '👑',
      'Lieutenant': '🔰',
      'Sergeant': '⚡',
      'Miner': '⛏️',
      'Scout': '👁️',
      'Spy': '🕵️',
      'Bomb': '💣',
      'Flag': '🏴'
    };
    return symbols[rank];
  };

  // Render a square
  const renderSquare = (row: number, col: number) => {
    const piece = gameState.board[row][col];
    const isSelected = selectedSquare && selectedSquare[0] === row && selectedSquare[1] === col;
    const isValidMove = validMoves.some(([r, c]) => r === row && c === col);
    const isLake = isLakePosition(row, col);
    const isLastMoveSquare = gameState.lastMove && 
      ((gameState.lastMove.from[0] === row && gameState.lastMove.from[1] === col) ||
       (gameState.lastMove.to[0] === row && gameState.lastMove.to[1] === col));
    
    return (
      <div
        key={`${row}-${col}`}
        className={`stratego-square ${isLake ? 'lake' : ''} ${isSelected ? 'selected' : ''} ${isValidMove ? 'valid-move' : ''} ${isLastMoveSquare ? 'last-move' : ''}`}
        onClick={() => handleSquareClick(row, col)}
      >
        {isLake && <div className="lake-water">🌊</div>}
        {piece && (
          <div className={`stratego-piece ${piece.color} ${piece.isRevealed || piece.color === playerColor ? 'revealed' : 'hidden'}`}>
            {piece.isRevealed || piece.color === playerColor ? 
              getPieceSymbol(piece.rank) : 
              '❓'
            }
          </div>
        )}
      </div>
    );
  };

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', p: 3 }}>
      {/* Game Info */}
      <Paper sx={{ p: 2, mb: 3, bgcolor: '#2E4057', color: 'white', borderRadius: 2 }}>
        <Typography variant="h4" align="center" gutterBottom sx={{ fontWeight: 'bold' }}>
          🎖️ Stratego Battle 🎖️
        </Typography>
        
        {gameState.gameStatus === 'active' && (
          <Typography align="center" variant="h6" sx={{ 
            bgcolor: gameState.currentPlayer === 'red' ? '#DC143C' : '#4169E1',
            color: 'white',
            p: 1,
            borderRadius: 1,
            fontWeight: 'bold'
          }}>
            {gameState.currentPlayer === playerColor ? "⚔️ Your Turn!" : `${gameState.currentPlayer.toUpperCase()}'s Turn`}
            {loading && " (Making move...)"}
          </Typography>
        )}
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Stratego Board */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
        <div className="stratego-board">
          {gameState.board.map((row, rowIndex) =>
            row.map((_, colIndex) => renderSquare(rowIndex, colIndex))
          )}
        </div>
      </Box>

      {/* Game End Dialog */}
      <Dialog open={gameEndDialog} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ textAlign: 'center', fontSize: '1.8rem', fontWeight: 'bold' }}>
          🎉 Victory! 🎉
        </DialogTitle>
        <DialogContent>
          <Typography variant="h4" align="center" sx={{ 
            color: gameState.winner === 'red' ? '#DC143C' : '#4169E1',
            fontWeight: 'bold',
            mb: 2
          }}>
            {gameState.winner ? `${gameState.winner.toUpperCase()} ARMY WINS!` : 'DRAW!'}
          </Typography>
          
          {gameState.winner === playerColor && (
            <Typography align="center" sx={{ 
              mt: 2, 
              color: 'success.main', 
              fontSize: '1.2rem',
              fontWeight: 'bold'
            }}>
              🏆 Congratulations, General! Victory is yours! 🏆
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center' }}>
          <Button 
            onClick={() => setGameEndDialog(false)}
            variant="contained"
            sx={{ 
              bgcolor: '#2E4057', 
              color: 'white',
              fontWeight: 'bold',
              '&:hover': { bgcolor: '#1e2a3a' }
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}; 