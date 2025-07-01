'use client';

import React, { useState, useCallback, useEffect } from 'react';
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

interface CombatResult {
  attacker: StrategoPiece;
  defender: StrategoPiece;
  winner: 'attacker' | 'defender' | 'both_destroyed';
  attackerPos: [number, number];
  defenderPos: [number, number];
}

interface GameState {
  board: (StrategoPiece | null)[][];
  currentPlayer: Player;
  redPlayer: string | null;
  bluePlayer: string | null;
  gameStatus: 'waiting' | 'setup' | 'active' | 'finished';
  winner: Player | null;
  setupPhase: boolean;
  setupTimeLeft: number; // 3 minutes for setup
  turnTimeLeft: number;  // 1 minute per turn
  lastMove?: {
    from: [number, number];
    to: [number, number];
    combat?: CombatResult;
  };
}

interface StrategoBoardProps {
  gameId: string;
}

// Time limits
const SETUP_TIME_LIMIT = 3 * 60 * 1000; // 3 minutes for setup
const TURN_TIME_LIMIT = 60 * 1000; // 1 minute per turn

// Lake positions on 10x10 board
const LAKE_POSITIONS = [
  [4, 2], [4, 3], [5, 2], [5, 3],  // Left lake
  [4, 6], [4, 7], [5, 6], [5, 7]   // Right lake
];

// Piece counts for setup (standard Stratego army)
const PIECE_COUNTS: Record<PieceRank, number> = {
  'Marshal': 1,
  'General': 1,
  'Colonel': 2,
  'Major': 3,
  'Captain': 4,
  'Lieutenant': 4,
  'Sergeant': 4,
  'Miner': 5,
  'Scout': 8,
  'Spy': 1,
  'Bomb': 6,
  'Flag': 1
};

// Piece rank values for combat
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
  'Bomb': 99,
  'Flag': 100
};

// Check if position is a lake
function isLakePosition(row: number, col: number): boolean {
  return LAKE_POSITIONS.some(([lakeRow, lakeCol]) => lakeRow === row && lakeCol === col);
}

// Check if position is in setup area for a player
function isSetupArea(row: number, player: Player): boolean {
  if (player === 'red') return row >= 6; // Bottom 4 rows for red
  return row <= 3; // Top 4 rows for blue
}

// Resolve combat between two pieces
function resolveCombat(attacker: StrategoPiece, defender: StrategoPiece): 'attacker' | 'defender' | 'both_destroyed' {
  if (defender.rank === 'Flag') return 'attacker';
  if (defender.rank === 'Bomb') {
    return attacker.rank === 'Miner' ? 'attacker' : 'defender';
  }
  if (attacker.rank === 'Spy' && defender.rank === 'Marshal') {
    return 'attacker';
  }
  if (attacker.rank === 'Bomb' || attacker.rank === 'Flag') {
    return 'defender';
  }

  const attackerValue = RANK_VALUES[attacker.rank];
  const defenderValue = RANK_VALUES[defender.rank];
  
  if (attackerValue < defenderValue) return 'attacker';
  if (attackerValue > defenderValue) return 'defender';
  return 'both_destroyed';
}

export const StrategoBoard: React.FC<StrategoBoardProps> = ({ gameId }) => {
  const { publicKey } = useWallet();
  const [gameState, setGameState] = useState<GameState>(() => ({
    board: Array(10).fill(null).map(() => Array(10).fill(null)),
    currentPlayer: 'red',
    redPlayer: null,
    bluePlayer: null,
    gameStatus: 'waiting',
    winner: null,
    setupPhase: false,
    setupTimeLeft: SETUP_TIME_LIMIT,
    turnTimeLeft: TURN_TIME_LIMIT,
  }));
  
  const [selectedSquare, setSelectedSquare] = useState<[number, number] | null>(null);
  const [validMoves, setValidMoves] = useState<[number, number][]>([]);
  const [playerColor, setPlayerColor] = useState<Player | null>(null);
  const [gameEndDialog, setGameEndDialog] = useState(false);
  const [combatDialog, setCombatDialog] = useState<CombatResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Setup state
  const [availablePieces, setAvailablePieces] = useState<Record<PieceRank, number>>(PIECE_COUNTS);
  const [selectedPieceType, setSelectedPieceType] = useState<PieceRank>('Scout');
  const [setupStartTime, setSetupStartTime] = useState<Date | null>(null);
  const [turnStartTime, setTurnStartTime] = useState<Date | null>(null);
  
  // For demo purposes - log the game ID and wallet
  console.log('Game ID:', gameId, 'Wallet:', publicKey?.toString());
  
  // Timer management
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (gameState.setupPhase && setupStartTime) {
      interval = setInterval(() => {
        const elapsed = Date.now() - setupStartTime.getTime();
        const remaining = Math.max(0, SETUP_TIME_LIMIT - elapsed);
        setGameState(prev => ({ ...prev, setupTimeLeft: remaining }));
        
        if (remaining <= 0) {
          // Auto-place remaining pieces randomly - will be implemented separately
          console.log('Setup time expired - auto-completing setup');
        }
      }, 1000);
    } else if (gameState.gameStatus === 'active' && turnStartTime) {
      interval = setInterval(() => {
        const elapsed = Date.now() - turnStartTime.getTime();
        const remaining = Math.max(0, TURN_TIME_LIMIT - elapsed);
        setGameState(prev => ({ ...prev, turnTimeLeft: remaining }));
        
        if (remaining <= 0) {
          // Make random move - will be implemented separately
          console.log('Turn time expired - making random move');
        }
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [gameState.setupPhase, gameState.gameStatus, setupStartTime, turnStartTime]);

  // Start setup timer when game begins
  useEffect(() => {
    if (gameState.gameStatus === 'setup' && !setupStartTime) {
      setSetupStartTime(new Date());
    }
  }, [gameState.gameStatus, setupStartTime]);

  // Get valid moves for a piece
  const getValidMoves = useCallback((row: number, col: number, piece: StrategoPiece): [number, number][] => {
    const moves: [number, number][] = [];
    if (!piece || !piece.canMove) return moves;

    if (piece.rank === 'Scout') {
      // Scout can move multiple spaces
      const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      
      for (const [dr, dc] of directions) {
        for (let distance = 1; distance < 10; distance++) {
          const newRow = row + dr * distance;
          const newCol = col + dc * distance;
          
          if (newRow < 0 || newRow >= 10 || newCol < 0 || newCol >= 10) break;
          if (isLakePosition(newRow, newCol)) break;
          
          const targetPiece = gameState.board[newRow][newCol];
          if (targetPiece) {
            if (targetPiece.color !== piece.color) {
              moves.push([newRow, newCol]);
            }
            break;
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
    
    if (!redFlag) return 'blue';
    if (!blueFlag) return 'red';
    if (redMovablePieces === 0) return 'blue';
    if (blueMovablePieces === 0) return 'red';
    
    return null;
  }, []);

  // Make a move with combat resolution
  const makeMove = useCallback(async (fromRow: number, fromCol: number, toRow: number, toCol: number) => {
    setLoading(true);
    
    const newBoard = gameState.board.map(row => [...row]);
    const attackingPiece = newBoard[fromRow][fromCol];
    const defendingPiece = newBoard[toRow][toCol];
    
    if (!attackingPiece) {
      setLoading(false);
      return;
    }
    
    let combatResult: CombatResult | undefined = undefined;
    
    if (defendingPiece) {
      // COMBAT! Show combat dialog
      const winner = resolveCombat(attackingPiece, defendingPiece);
      combatResult = {
        attacker: attackingPiece,
        defender: defendingPiece,
        winner,
        attackerPos: [fromRow, fromCol],
        defenderPos: [toRow, toCol]
      };
      
      // Show combat animation
      setCombatDialog(combatResult);
      
      // Reveal both pieces after combat
      attackingPiece.isRevealed = true;
      defendingPiece.isRevealed = true;
      
      // Wait for combat dialog to close before applying results
      setTimeout(() => {
        const updatedBoard = newBoard.map(row => [...row]);
        
        if (combatResult) {
          switch (combatResult.winner) {
            case 'attacker':
              updatedBoard[toRow][toCol] = attackingPiece;
              updatedBoard[fromRow][fromCol] = null;
              break;
            case 'defender':
              updatedBoard[fromRow][fromCol] = null;
              break;
            case 'both_destroyed':
              updatedBoard[fromRow][fromCol] = null;
              updatedBoard[toRow][toCol] = null;
              break;
          }
        }
        
        const gameWinner = checkWinner(updatedBoard);
        
        setGameState(prev => ({
          ...prev,
          board: updatedBoard,
          currentPlayer: prev.currentPlayer === 'red' ? 'blue' : 'red',
          gameStatus: gameWinner ? 'finished' : 'active',
          winner: gameWinner,
          lastMove: {
            from: [fromRow, fromCol],
            to: [toRow, toCol],
            combat: combatResult
          }
        }));
        
        if (gameWinner) {
          setGameEndDialog(true);
        } else {
          setTurnStartTime(new Date());
        }
        
        setCombatDialog(null);
        setLoading(false);
      }, 3000); // Show combat for 3 seconds
      
    } else {
      // Simple move
      newBoard[toRow][toCol] = attackingPiece;
      newBoard[fromRow][fromCol] = null;
      
      const winner = checkWinner(newBoard);
      
      setGameState(prev => ({
        ...prev,
        board: newBoard,
        currentPlayer: prev.currentPlayer === 'red' ? 'blue' : 'red',
        gameStatus: winner ? 'finished' : 'active',
        winner,
        lastMove: {
          from: [fromRow, fromCol],
          to: [toRow, toCol]
        }
      }));
      
      if (winner) {
        setGameEndDialog(true);
      } else {
        setTurnStartTime(new Date());
      }
      
      setLoading(false);
    }
  }, [gameState, checkWinner]);

  // Handle square click during setup
  const handleSetupClick = useCallback((row: number, col: number) => {
    if (!playerColor || !isSetupArea(row, playerColor)) return;
    if (isLakePosition(row, col)) return;
    if (availablePieces[selectedPieceType] <= 0) return;
    
    const newBoard = [...gameState.board];
    
    // Remove existing piece if any
    if (newBoard[row][col]) {
      const existingPiece = newBoard[row][col]!;
      setAvailablePieces(prev => ({
        ...prev,
        [existingPiece.rank]: prev[existingPiece.rank] + 1
      }));
    }
    
    // Place new piece
    newBoard[row][col] = {
      color: playerColor,
      rank: selectedPieceType,
      isRevealed: false,
      canMove: selectedPieceType !== 'Bomb' && selectedPieceType !== 'Flag'
    };
    
    setAvailablePieces(prev => ({
      ...prev,
      [selectedPieceType]: prev[selectedPieceType] - 1
    }));
    
    setGameState(prev => ({ ...prev, board: newBoard }));
  }, [gameState.board, playerColor, selectedPieceType, availablePieces]);

  // Handle square click during active play
  const handleActiveClick = useCallback((row: number, col: number) => {
    if (gameState.currentPlayer !== playerColor) return;
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
  }, [gameState.currentPlayer, gameState.board, playerColor, loading, selectedSquare, validMoves, makeMove, getValidMoves]);

  // Handle square click
  const handleSquareClick = useCallback((row: number, col: number) => {
    if (gameState.setupPhase) {
      handleSetupClick(row, col);
    } else {
      handleActiveClick(row, col);
    }
  }, [gameState.setupPhase, handleSetupClick, handleActiveClick]);

  // Complete setup
  const completeSetup = useCallback(() => {
    const totalPlaced = Object.values(availablePieces).reduce((sum, count) => sum + count, 0);
    const totalPieces = Object.values(PIECE_COUNTS).reduce((sum, count) => sum + count, 0);
    
    if (totalPlaced < totalPieces) {
      setError('Please place all pieces before starting the battle!');
      return;
    }
    
    setGameState(prev => ({
      ...prev,
      setupPhase: false,
      gameStatus: 'active'
    }));
    
    setTurnStartTime(new Date());
  }, [availablePieces]);

  // Get image for piece rank with numbered variants
  const getPieceImage = (rank: PieceRank, color: PieceColor, isRevealed: boolean): string => {
    if (!color) return '';
    
    // If piece is not revealed and not your piece, show hidden piece
    if (!isRevealed && color !== playerColor) {
      return `/images/stratego/pieces/${color}-hidden.png`;
    }
    
    // Get piece counts to determine if we need numbered variants
    const pieceCount = PIECE_COUNTS[rank];
    const rankName = rank.toLowerCase();
    
    // For pieces with only 1 copy, use simple naming
    if (pieceCount === 1) {
      return `/images/stratego/pieces/${color}-${rankName}.png`;
    }
    
    // For pieces with multiple copies, randomly select a variant
    const variantNumber = Math.floor(Math.random() * pieceCount) + 1;
    return `/images/stratego/pieces/${color}-${rankName}-${variantNumber}.png`;
  };

  // Get symbol for piece rank (fallback if image fails)
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

  // Format time
  const formatTime = (milliseconds: number): string => {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Render a square
  const renderSquare = (row: number, col: number) => {
    const piece = gameState.board[row][col];
    const isSelected = selectedSquare && selectedSquare[0] === row && selectedSquare[1] === col;
    const isValidMove = validMoves.some(([r, c]) => r === row && c === col);
    const isLake = isLakePosition(row, col);
    const isSetupAreaForPlayer = playerColor && isSetupArea(row, playerColor);
    const isLastMoveSquare = gameState.lastMove && 
      ((gameState.lastMove.from[0] === row && gameState.lastMove.from[1] === col) ||
       (gameState.lastMove.to[0] === row && gameState.lastMove.to[1] === col));
    
    return (
      <div
        key={`${row}-${col}`}
        className={`stratego-square ${isLake ? 'lake' : ''} ${isSelected ? 'selected' : ''} ${isValidMove ? 'valid-move' : ''} ${isLastMoveSquare ? 'last-move' : ''} ${gameState.setupPhase && isSetupAreaForPlayer ? 'setup-area' : ''}`}
        onClick={() => handleSquareClick(row, col)}
      >
        {isLake && <div className="lake-water">🌊</div>}
        {piece && (
          <div className={`stratego-piece ${piece.color} ${piece.isRevealed || piece.color === playerColor ? 'revealed' : 'hidden'}`}>
            <img 
              src={getPieceImage(piece.rank, piece.color, piece.isRevealed)} 
              alt={piece.isRevealed || piece.color === playerColor ? piece.rank : 'Hidden piece'}
              className="piece-image"
              onError={(e) => {
                // Fallback to emoji if image fails to load
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                (target.nextElementSibling as HTMLElement)!.style.display = 'block';
              }}
            />
            <span className="piece-fallback" style={{ display: 'none' }}>
              {piece.isRevealed || piece.color === playerColor ? 
                getPieceSymbol(piece.rank) : 
                piece.color === 'red' ? '🔴' : '🔵'
              }
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      {/* Game Info */}
      <Paper sx={{ p: 2, mb: 3, bgcolor: '#2E4057', color: 'white', borderRadius: 2 }}>
        <Typography variant="h4" align="center" gutterBottom sx={{ fontWeight: 'bold' }}>
          🎖️ Stratego Battle 🎖️
        </Typography>
        
        {/* Timer Display */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          {gameState.setupPhase ? (
            <Paper sx={{ p: 1, bgcolor: gameState.setupTimeLeft < 60000 ? '#d32f2f' : '#2e7d32', color: 'white' }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                🏗️ Setup: {formatTime(gameState.setupTimeLeft)}
              </Typography>
            </Paper>
          ) : gameState.gameStatus === 'active' ? (
            <Paper sx={{ p: 1, bgcolor: gameState.turnTimeLeft < 10000 ? '#d32f2f' : '#2e7d32', color: 'white' }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                ⏰ Turn: {formatTime(gameState.turnTimeLeft)}
              </Typography>
            </Paper>
          ) : null}
        </Box>
        
        {gameState.setupPhase && (
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h6" sx={{ 
              bgcolor: '#ff9800',
              color: 'white',
              p: 1,
              borderRadius: 1,
              fontWeight: 'bold',
              mb: 2
            }}>
              🏗️ Deploy Your Army! Place all pieces in your territory.
            </Typography>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setPlayerColor(playerColor === 'red' ? 'blue' : 'red')}
              sx={{ color: 'white', borderColor: 'white' }}
            >
              Playing as: {playerColor === 'red' ? '🔴 RED' : '🔵 BLUE'}
            </Button>
          </Box>
        )}
        
        {gameState.gameStatus === 'active' && (
          <Typography align="center" variant="h6" sx={{ 
            bgcolor: gameState.currentPlayer === 'red' ? '#DC143C' : '#4169E1',
            color: 'white',
            p: 1,
            borderRadius: 1,
            fontWeight: 'bold'
          }}>
            {gameState.currentPlayer === playerColor ? "⚔️ Your Turn!" : `${gameState.currentPlayer.toUpperCase()}'s Turn`}
            {loading && " (Processing...)"}
          </Typography>
        )}
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
        {/* Setup Panel */}
        {gameState.setupPhase && (
          <Box sx={{ width: { xs: '100%', md: '300px' } }}>
            <Paper sx={{ p: 2, bgcolor: 'rgba(46, 64, 87, 0.1)' }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                🎯 Deploy Pieces
              </Typography>
              
              <Box sx={{ mb: 2 }}>
                {Object.entries(availablePieces).map(([rank, count]) => (
                  <Button
                    key={rank}
                    variant={selectedPieceType === rank ? 'contained' : 'outlined'}
                    size="small"
                    sx={{ m: 0.5, minWidth: 'auto' }}
                    onClick={() => setSelectedPieceType(rank as PieceRank)}
                    disabled={count === 0}
                  >
                    {getPieceSymbol(rank as PieceRank)} {count}
                  </Button>
                ))}
              </Box>
              
              <Button
                variant="contained"
                fullWidth
                onClick={completeSetup}
                disabled={Object.values(availablePieces).some(count => count > 0)}
                sx={{ bgcolor: '#2E4057', '&:hover': { bgcolor: '#1e2a3a' } }}
              >
                ⚔️ Start Battle!
              </Button>
            </Paper>
          </Box>
        )}
        
        {/* Game Board */}
        <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <div className="stratego-board">
            {gameState.board.map((row, rowIndex) =>
              row.map((_, colIndex) => renderSquare(rowIndex, colIndex))
            )}
          </div>
        </Box>
      </Box>

      {/* Combat Dialog */}
      <Dialog open={!!combatDialog} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ textAlign: 'center', fontSize: '1.8rem', fontWeight: 'bold' }}>
          ⚔️ BATTLE! ⚔️
        </DialogTitle>
        <DialogContent>
          {combatDialog && (
            <Box sx={{ textAlign: 'center' }}>
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4, mb: 3 }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h6" sx={{ color: '#DC143C', fontWeight: 'bold' }}>
                    🔴 ATTACKER
                  </Typography>
                  <Typography variant="h3" sx={{ my: 2 }}>
                    {getPieceSymbol(combatDialog.attacker.rank)}
                  </Typography>
                  <Typography variant="h6">
                    {combatDialog.attacker.rank}
                  </Typography>
                </Box>
                
                <Typography variant="h2" sx={{ color: '#ff9800' }}>
                  ⚔️
                </Typography>
                
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h6" sx={{ color: '#4169E1', fontWeight: 'bold' }}>
                    🔵 DEFENDER
                  </Typography>
                  <Typography variant="h3" sx={{ my: 2 }}>
                    {getPieceSymbol(combatDialog.defender.rank)}
                  </Typography>
                  <Typography variant="h6">
                    {combatDialog.defender.rank}
                  </Typography>
                </Box>
              </Box>
              
              <Typography variant="h4" sx={{ 
                color: combatDialog.winner === 'both_destroyed' ? '#ff9800' : 
                      combatDialog.winner === 'attacker' ? '#DC143C' : '#4169E1',
                fontWeight: 'bold'
              }}>
                {combatDialog.winner === 'attacker' ? '🔴 ATTACKER WINS!' :
                 combatDialog.winner === 'defender' ? '🔵 DEFENDER WINS!' :
                 '💥 BOTH DESTROYED!'}
              </Typography>
            </Box>
          )}
        </DialogContent>
      </Dialog>

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
            sx={{ bgcolor: '#2E4057', '&:hover': { bgcolor: '#1e2a3a' } }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <style jsx>{`
        .stratego-board {
          display: grid;
          grid-template-columns: repeat(10, 50px);
          grid-template-rows: repeat(10, 50px);
          gap: 1px;
          border: 3px solid #2E4057;
          border-radius: 8px;
          background-color: #2E4057;
        }
        
        .stratego-square {
          width: 50px;
          height: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          background-color: #F5DEB3;
          position: relative;
          transition: all 0.2s ease;
        }
        
        .stratego-square.lake {
          background-color: #4169E1;
          cursor: not-allowed;
        }
        
        .stratego-square.setup-area {
          background-color: #90EE90;
        }
        
        .stratego-square.selected {
          background-color: #FFD700 !important;
          box-shadow: inset 0 0 10px rgba(0,0,0,0.5);
        }
        
        .stratego-square.valid-move {
          background-color: #FFA500 !important;
        }
        
        .stratego-square.last-move {
          background-color: #87CEEB !important;
        }
        
        .stratego-square:hover:not(.lake) {
          opacity: 0.8;
        }
        
        .stratego-piece {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: 2px solid #333;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
          transition: transform 0.2s ease;
          overflow: hidden;
          position: relative;
        }
        
        .piece-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 50%;
        }
        
        .piece-fallback {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 16px;
        }
        
        .stratego-piece.red {
          background: radial-gradient(circle, #FF6B6B, #CC0000);
          color: white;
        }
        
        .stratego-piece.blue {
          background: radial-gradient(circle, #6BB6FF, #0066CC);
          color: white;
        }
        
        .stratego-piece.hidden {
          background: #666;
          color: white;
        }
        
        .lake-water {
          font-size: 20px;
        }
      `}</style>
    </Box>
  );
}; 