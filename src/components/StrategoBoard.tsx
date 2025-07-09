'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useWallet } from '@solana/wallet-adapter-react';
import { Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions, Paper, Alert, CircularProgress, IconButton } from '@mui/material';
import { ArrowBackIos, ArrowForwardIos } from '@mui/icons-material';
import GameEndModal from './GameEndModal';
import { PublicKey } from '@solana/web3.js';
import { magicBlockManager } from '../lib/magicblock';

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
  imagePath?: string;  // Store specific variant image path
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
  redPlayerReady: boolean;
  bluePlayerReady: boolean;
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
const SETUP_TIME_LIMIT = 10 * 60 * 1000; // 10 minutes for setup
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
  const { publicKey, signTransaction } = useWallet();
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
    // INITIALIZE READY STATES
    redPlayerReady: false,
    bluePlayerReady: false,
  }));
  
  const [selectedSquare, setSelectedSquare] = useState<[number, number] | null>(null);
  const [validMoves, setValidMoves] = useState<[number, number][]>([]);
  const [playerColor, setPlayerColor] = useState<Player | null>(null);
  const [gameEndDialog, setGameEndDialog] = useState(false);
  const [gameEndWinner, setGameEndWinner] = useState<Player | null>(null); // Store winner at detection time
  const [combatDialog, setCombatDialog] = useState<CombatResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Setup state
  const [availablePieces, setAvailablePieces] = useState<Record<PieceRank, number>>(PIECE_COUNTS);
  const [showPieceSelector, setShowPieceSelector] = useState(false);
  const [selectedSetupSquare, setSelectedSetupSquare] = useState<[number, number] | null>(null);

  // Forfeit dialog state
  const [showForfeitDialog, setShowForfeitDialog] = useState(false);
  const [forfeitLoading, setForfeitLoading] = useState(false);
  
  // Game state management
  const [gameStartTime, setGameStartTime] = useState<Date | null>(null);
  const [escrowStatus, setEscrowStatus] = useState<{
    escrows: {
      id: string;
      wallet_address: string;
      amount: string;
      status: string;
      username: string;
    }[];
    totalEscrowed: number;
    platformFeePercentage: number;
    estimatedPlatformFee: number;
    estimatedWinnerAmount: number;
  } | null>(null);
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);

  // MagicBlock state
  const [ephemeralSession, setEphemeralSession] = useState<string | null>(null);
  const [moveLatency, setMoveLatency] = useState<number>(0);
  const [realTimeMoves, setRealTimeMoves] = useState<number>(0);
  
  // Piece image cache to maintain consistent variants
  const [pieceImageCache] = useState<Map<string, string>>(new Map());
  const [payoutAmount, setPayoutAmount] = useState<number>(0);
  const [payoutSignature, setPayoutSignature] = useState<string | null>(null);
  
  // Track individual piece variants that have been used
  const [usedPieceVariants, setUsedPieceVariants] = useState<Set<string>>(new Set());
  
  // Track initialization to prevent loops
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Ref to prevent multiple auto-placement calls
  const autoPlacementRunning = useRef(false);
  
  // Carousel pagination state
  const [carouselPage, setCarouselPage] = useState(0);
  
  // Create all piece variants array for 5x3 grid
  const allPieceVariants = React.useMemo(() => {
    const variants: Array<{
      rank: PieceRank;
      imagePath: string;
      displayName: string;
      available: boolean;
    }> = [];
    
    Object.entries(PIECE_COUNTS).forEach(([rank, count]) => {
      if (count === 1) {
        // Single pieces: Marshal, General, Spy, Flag
        const imagePath = `/images/stratego/pieces/${playerColor}-${rank.toLowerCase()}.png`;
        variants.push({
          rank: rank as PieceRank,
          imagePath,
          displayName: rank,
          available: availablePieces[rank as PieceRank] > 0 && !usedPieceVariants.has(imagePath)
        });
      } else {
        // Multiple pieces: Show ALL numbered variants
        for (let variant = 1; variant <= count; variant++) {
          const imagePath = `/images/stratego/pieces/${playerColor}-${rank.toLowerCase()}-${variant}.png`;
          variants.push({
            rank: rank as PieceRank,
            imagePath,
            displayName: `${rank} #${variant}`,
            available: availablePieces[rank as PieceRank] > 0 && !usedPieceVariants.has(imagePath)
          });
        }
      }
    });
    
    return variants;
  }, [playerColor, availablePieces, usedPieceVariants]);

  // For demo purposes - log the game ID and wallet
  console.log('Game ID:', gameId, 'Wallet:', publicKey?.toString());
  
  // Complete game and handle payouts (moved up for handleForfeit dependency)
  const completeGame = useCallback(async (winner: Player) => {
    if (!currentPlayerId || !publicKey) return;
    
    try {
      console.log('🚀 Completing game with data:', {
        winner,
        playerId: currentPlayerId,
        walletAddress: publicKey.toString(),
        gameId
      });
      
      const response = await fetch(`/api/games/${gameId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          winner,
          playerId: currentPlayerId,
          walletAddress: publicKey.toString()
        })
      });
      
      console.log('📡 Completion API response status:', response.status);
      console.log('📡 Completion API response headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        // Try to get detailed error information
        let errorDetails;
        try {
          errorDetails = await response.json();
          console.error('❌ Detailed API error:', errorDetails);
        } catch (jsonError) {
          console.error('❌ Failed to parse error response as JSON:', jsonError);
          try {
            errorDetails = await response.text();
            console.error('❌ Error response as text:', errorDetails);
          } catch (textError) {
            console.error('❌ Failed to get error response as text:', textError);
            errorDetails = `HTTP ${response.status} ${response.statusText}`;
          }
        }
        
        setError(`Game completion failed (${response.status}): ${JSON.stringify(errorDetails)}`);
        return;
      }
      
      const result = await response.json();
      console.log('✅ Completion API success:', result);
      
      if (result.payout?.amount && result.payout?.signature) {
        setPayoutAmount(result.payout.amount);
        setPayoutSignature(result.payout.signature);

        setGameEndWinner(winner);
        setGameEndDialog(true);
        console.log('💰 Payout completed:', result.payout);
      } else if (result.escrowReleased && result.escrowTransactionSignature) {
        // Handle direct SOL transfer result
        setPayoutAmount(result.winnerAmount || 0);
        setPayoutSignature(result.escrowTransactionSignature);

        setGameEndWinner(winner);
        setGameEndDialog(true);
        console.log('💰 Direct SOL transfer completed:', result);
      } else {
        console.warn('⚠️ Game completed but no payout information received:', result);
        setGameEndWinner(winner);
        setGameEndDialog(true);
      }
    } catch (error) {
      console.error('❌ Error completing game:', error);
      setError(`Network error completing game: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [gameId, currentPlayerId, publicKey]);

  // Save game state to API (moved up for placePiece dependency)
  const saveGameState = useCallback(async (state: GameState) => {
    console.log('🔍 saveGameState called with:', {
      publicKey: publicKey?.toString(),
      currentPlayerId,
      gameId,
      boardHasPieces: state.board.some(row => row.some(cell => cell !== null)),
      gameStatus: state.gameStatus,
      setupPhase: state.setupPhase
    });
    
    if (!publicKey || !currentPlayerId) {
      console.error('❌ saveGameState failed: missing publicKey or currentPlayerId', {
        publicKey: !!publicKey,
        currentPlayerId: !!currentPlayerId
      });
      return;
    }
    
    try {
      const requestBody = {
        newState: state,
        playerId: currentPlayerId
      };
      
      console.log('📤 Sending state to API:', {
        gameId,
        playerId: currentPlayerId,
        boardPieceCount: state.board.flat().filter(cell => cell !== null).length,
        requestBody
      });
      
      const response = await fetch(`/api/games/${gameId}/state`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const responseText = await response.text();
        console.error('❌ Failed to save game state:', {
          status: response.status,
          responseText
        });
        setError(`Failed to save game state: ${response.status} - ${responseText}`);
      } else {
        const result = await response.json();
        console.log('✅ Game state saved successfully:', result);
        if (error) setError(null);
      }
    } catch (error) {
      console.error('❌ Error saving game state:', error);
      setError('Failed to save game state: Network error');
    }
  }, [gameId, publicKey, currentPlayerId, error]);

  // Handle forfeit (moved up for timer dependency)
  const handleForfeit = useCallback(async () => {
    if (!playerColor || !currentPlayerId) return;
    
    const opponent: Player = playerColor === 'red' ? 'blue' : 'red';
    setForfeitLoading(true);
    
    try {
      console.log(`🏳️ ${playerColor} forfeiting - ${opponent} wins!`);
      
      await completeGame(opponent);
      
      const newState = { ...gameState, winner: opponent, gameStatus: 'finished' as const };
      setGameState(newState);
    } catch (error) {
      console.error('❌ Error forfeiting game:', error);
      setError('Failed to forfeit game');
    } finally {
      setForfeitLoading(false);
      setShowForfeitDialog(false);
    }
  }, [playerColor, currentPlayerId, gameState, completeGame]);

  // Auto-place remaining pieces randomly when setup timer expires
  const autoPlaceRemainingPieces = useCallback(async () => {
    if (!playerColor) return;
    
    // GUARD: Prevent multiple simultaneous calls
    if (autoPlacementRunning.current) {
      console.log('❌ Auto-placement already running, skipping');
      return;
    }
    
    // GUARD: Prevent multiple calls
    if (gameState.gameStatus !== 'setup' || !gameState.setupPhase) {
      console.log('❌ Auto-placement blocked - game not in setup phase');
      return;
    }
    
    autoPlacementRunning.current = true;
    console.log('⏰ Setup time expired - auto-placing remaining pieces...');
    
    try {
      // Get all valid setup positions for this player
      const validPositions: [number, number][] = [];
      for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 10; col++) {
          if (isSetupArea(row, playerColor) && !isLakePosition(row, col) && !gameState.board[row][col]) {
            validPositions.push([row, col]);
          }
        }
      }
      
      console.log(`📍 Found ${validPositions.length} valid empty positions for auto-placement`);
      
      // Get remaining pieces that need to be placed
      const remainingPieces: { rank: PieceRank; count: number }[] = [];
      Object.entries(availablePieces).forEach(([rank, count]) => {
        if (count > 0) {
          remainingPieces.push({ rank: rank as PieceRank, count });
        }
      });
      
      console.log('🎲 Remaining pieces to place:', remainingPieces);
      
      if (remainingPieces.length === 0) {
        console.log('✅ No remaining pieces - starting game immediately');
        // Transition to active game phase
        const activeState = {
          ...gameState,
          setupPhase: false,
          gameStatus: 'active' as const
        };
        setGameState(activeState);
        await saveGameState(activeState);
        return;
      }
      
      // Shuffle valid positions for random placement
      const shuffledPositions = [...validPositions].sort(() => Math.random() - 0.5);
      
      const newBoard = [...gameState.board];
      const newAvailablePieces = { ...availablePieces };
      const newUsedVariants = new Set(usedPieceVariants);
      
      let positionIndex = 0;
      
      // Place each remaining piece randomly
      for (const { rank, count } of remainingPieces) {
        for (let i = 0; i < count; i++) {
          if (positionIndex >= shuffledPositions.length) {
            console.error('❌ Ran out of valid positions for auto-placement!');
            break;
          }
          
          const [row, col] = shuffledPositions[positionIndex];
          positionIndex++;
          
          // Generate random variant for pieces with multiple copies
          let imagePath: string;
          if (PIECE_COUNTS[rank] === 1) {
            imagePath = `/images/stratego/pieces/${playerColor}-${rank.toLowerCase()}.png`;
          } else {
            // Find an unused variant
            let variantNumber = 1;
            do {
              imagePath = `/images/stratego/pieces/${playerColor}-${rank.toLowerCase()}-${variantNumber}.png`;
              variantNumber++;
            } while (newUsedVariants.has(imagePath) && variantNumber <= PIECE_COUNTS[rank]);
          }
          
          // Place the piece
          newBoard[row][col] = {
            color: playerColor,
            rank: rank,
            isRevealed: false,
            canMove: rank !== 'Bomb' && rank !== 'Flag',
            imagePath: imagePath
          };
          
          newUsedVariants.add(imagePath);
          newAvailablePieces[rank]--;
          
          console.log(`🎲 Auto-placed ${rank} at [${row}, ${col}] with image ${imagePath}`);
        }
      }
      
      // Update state
      const newState = {
        ...gameState,
        board: newBoard
      };
      
      setGameState(newState);
      setAvailablePieces(newAvailablePieces);
      setUsedPieceVariants(newUsedVariants);
      
      // Save state to database
      await saveGameState(newState);
      
      console.log('✅ Auto-placement complete - starting game!');
      
      // Show notification to user
      const totalAutoPlaced = remainingPieces.reduce((sum, { count }) => sum + count, 0);
      setError(`⏰ Setup time expired! Auto-placed ${totalAutoPlaced} remaining pieces randomly. Game starting!`);
      
      // Clear the notification after 5 seconds
      setTimeout(() => setError(null), 5000);
      
      // Start the game by transitioning to active phase
      const activeState = {
        ...newState,
        setupPhase: false,
        gameStatus: 'active' as const
      };
      
      setGameState(activeState);
      await saveGameState(activeState);
    } catch (error) {
      console.error('❌ Error during auto-placement:', error);
    } finally {
      autoPlacementRunning.current = false;
    }
  }, [playerColor, gameState, availablePieces, usedPieceVariants, saveGameState]);

  // Timer effect for setup and turn timers
  useEffect(() => {
    if (!gameState.setupPhase || !gameStartTime) return;
    
    console.log('⏱️ Timer effect running:', {
      setupPhase: gameState.setupPhase,
      gameStatus: gameState.gameStatus,
      gameStartTime: gameStartTime.toISOString(),
      currentTime: new Date().toISOString()
    });
    
    const timer = setInterval(() => {
      // Calculate time remaining based on server timestamp
      const now = new Date();
      const elapsedTime = now.getTime() - gameStartTime.getTime();
      const timeRemaining = Math.max(0, SETUP_TIME_LIMIT - elapsedTime);
      
      // Only log occasionally to avoid spam
      if (Math.floor(timeRemaining / 1000) % 10 === 0) {
        console.log('⏱️ Timer update:', {
          elapsedTime: Math.floor(elapsedTime / 1000),
          timeRemaining: Math.floor(timeRemaining / 1000),
          setupPhase: gameState.setupPhase,
          gameStatus: gameState.gameStatus
        });
      }
      
      setGameState(prev => ({
        ...prev,
        setupTimeLeft: timeRemaining
      }));
      
      // Auto-place remaining pieces and start game if time runs out
      // GUARD: Only trigger if we're still in setup phase
      if (timeRemaining <= 0 && gameState.setupPhase && gameState.gameStatus === 'setup') {
        console.log('⏰ Setup time expired - auto-placing remaining pieces and starting game');
        autoPlaceRemainingPieces();
      }
    }, 1000);
    
    return () => {
      console.log('⏱️ Cleaning up timer');
      clearInterval(timer);
    };
  }, [gameState.setupPhase, gameStartTime, gameState.gameStatus, autoPlaceRemainingPieces]);

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

  // Check for winner - IMPROVED LOGIC TO PREVENT IMMEDIATE GAME OVER
  const checkWinner = useCallback((board: (StrategoPiece | null)[][]): Player | null => {
    // CRITICAL: Don't check for winners during setup phase!
    if (gameState.setupPhase || gameState.gameStatus !== 'active') {
      console.log('❌ Winner check blocked - not in active gameplay phase');
      return null;
    }
    
    // ADDITIONAL GUARD: Don't check winner if both players aren't ready
    if (!gameState.redPlayerReady || !gameState.bluePlayerReady) {
      console.log('❌ Winner check blocked - players not ready');
      return null;
    }
    
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
    
    // Only declare winner if flag is actually captured or no movable pieces
    if (!redFlag) {
      console.log('🏁 Blue wins - Red flag captured!');
      return 'blue';
    }
    if (!blueFlag) {
      console.log('🏁 Red wins - Blue flag captured!');
      return 'red';
    }
    if (redMovablePieces === 0) {
      console.log('🏁 Blue wins - Red has no movable pieces!');
      return 'blue';
    }
    if (blueMovablePieces === 0) {
      console.log('🏁 Red wins - Blue has no movable pieces!');
      return 'red';
    }
    
    return null;
  }, [gameState.setupPhase, gameState.gameStatus, gameState.redPlayerReady, gameState.bluePlayerReady]);

  // Make a move with combat resolution
  const makeMove = useCallback(async (fromRow: number, fromCol: number, toRow: number, toCol: number) => {
    setLoading(true);
    
    // Track MagicBlock performance
    const moveStart = Date.now();
    setMoveLatency(Date.now() - moveStart);
    setRealTimeMoves(prev => prev + 1);
    
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

      }
      
      setLoading(false);
    }
  }, [gameState, checkWinner]);

  // Get image for piece rank with cached numbered variants
  const getPieceImage = useCallback((rank: PieceRank, color: PieceColor, isRevealed: boolean): string => {
    if (!color) return '';
    
    // If piece is not revealed and not your piece, show hidden piece
    if (!isRevealed && color !== playerColor) {
      return `/images/stratego/pieces/${color}-hidden.png`;
    }
    
    const rankName = rank.toLowerCase();
    const cacheKey = `${color}-${rank}`;
    
    // Check cache first
    if (pieceImageCache.has(cacheKey)) {
      return pieceImageCache.get(cacheKey)!;
    }
    
    let imagePath: string;
    
    // For pieces with only 1 copy, use simple naming
    if (PIECE_COUNTS[rank] === 1) {
      imagePath = `/images/stratego/pieces/${color}-${rankName}.png`;
    } else {
      // For pieces with multiple copies, randomly select a variant (1-indexed)
      const variantNumber = Math.floor(Math.random() * PIECE_COUNTS[rank]) + 1;
      imagePath = `/images/stratego/pieces/${color}-${rankName}-${variantNumber}.png`;
    }
    
    // Cache the selection
    pieceImageCache.set(cacheKey, imagePath);
    
    console.log(`Generated piece image: ${imagePath} for ${color} ${rank}`);
    return imagePath;
  }, [playerColor, pieceImageCache]);

  // Get the correct image to display for a piece based on game state and ownership
  const getDisplayImageForPiece = useCallback((piece: StrategoPiece): string => {
    // During setup phase: always show actual piece (only your pieces are visible anyway)
    if (gameState.setupPhase) {
      return piece.imagePath || getPieceImage(piece.rank, piece.color, true);
    }
    
    // During active gameplay: 
    // - Show YOUR pieces normally (use stored imagePath or generate one)
    // - Show OPPONENT pieces as hidden (unless revealed through combat)
    if (piece.color === playerColor) {
      // Your piece: show actual piece image
      const imagePath = piece.imagePath || getPieceImage(piece.rank, piece.color, true);
      return imagePath;
    } else {
      // Opponent piece: show hidden unless revealed through combat
      if (piece.isRevealed) {
        const imagePath = getPieceImage(piece.rank, piece.color, true);
        return imagePath;
      } else {
        const hiddenPath = `/images/stratego/pieces/${piece.color}-hidden.png`;
        return hiddenPath;
      }
    }
  }, [gameState.setupPhase, playerColor, getPieceImage]);

  // Remove piece from board
  const removePiece = useCallback(async (row: number, col: number) => {
    if (!gameState.board[row][col]) return;
    
    const piece = gameState.board[row][col]!;
    const newBoard = [...gameState.board];
    newBoard[row][col] = null;
    
    // Return piece to available pool
    setAvailablePieces(prev => ({
      ...prev,
      [piece.rank]: prev[piece.rank] + 1
    }));
    
    // Remove from used variants
    if (piece.imagePath) {
      setUsedPieceVariants(prev => {
        const newSet = new Set(prev);
        newSet.delete(piece.imagePath!);
        return newSet;
      });
    }
    
    const newState = {
      ...gameState,
      board: newBoard
    };
    
    setGameState(newState);
    
    // IMMEDIATELY save to database like checkers
    await saveGameState(newState);
    
    console.log(`Removed ${piece.rank} from [${row}, ${col}]`);
  }, [gameState, saveGameState, setUsedPieceVariants]);

  // Handle square click during setup
  const handleSetupClick = useCallback((row: number, col: number) => {
    if (!playerColor || !isSetupArea(row, playerColor)) return;
    if (isLakePosition(row, col)) return;
    
    const piece = gameState.board[row][col];
    
    // If there's already a piece here and it's yours, remove it
    if (piece && piece.color === playerColor) {
      removePiece(row, col);
      return;
    }
    
    // Otherwise, show piece selector for this empty square
    setSelectedSetupSquare([row, col]);
    setShowPieceSelector(true);
  }, [playerColor, gameState.board, removePiece]);

  // Place selected piece on board
  const placePiece = useCallback(async (pieceRank: PieceRank, specificImagePath: string) => {
    if (!selectedSetupSquare || !playerColor) return;
    if (availablePieces[pieceRank] <= 0) return;

    const [row, col] = selectedSetupSquare;
    const newBoard = [...gameState.board];
    
    // Remove existing piece if any
    if (newBoard[row][col]) {
      const existingPiece = newBoard[row][col]!;
      setAvailablePieces(prev => ({
        ...prev,
        [existingPiece.rank]: prev[existingPiece.rank] + 1
      }));
      
      // Remove from used variants if replacing
      if (existingPiece.imagePath) {
        setUsedPieceVariants(prev => {
          const newSet = new Set(prev);
          newSet.delete(existingPiece.imagePath!);
          return newSet;
        });
      }
    }
    
    // Place new piece with specific image
    newBoard[row][col] = {
      color: playerColor,
      rank: pieceRank,
      isRevealed: false,
      canMove: pieceRank !== 'Bomb' && pieceRank !== 'Flag',
      imagePath: specificImagePath
    };
    
    console.log(`Placed ${pieceRank} with specific image: ${specificImagePath} at [${row}, ${col}]`);
    
    // Mark this specific variant as used
    setUsedPieceVariants(prev => new Set(prev).add(specificImagePath));
    
    setAvailablePieces(prev => ({
      ...prev,
      [pieceRank]: prev[pieceRank] - 1
    }));
    
    const newState = {
      ...gameState,
      board: newBoard
    };
    
    setGameState(newState);
    
    // IMMEDIATELY save to database like checkers
    await saveGameState(newState);
    
    setShowPieceSelector(false);
    setSelectedSetupSquare(null);
  }, [selectedSetupSquare, playerColor, availablePieces, gameState, saveGameState, setUsedPieceVariants]);

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



  // Random setup - place all remaining pieces randomly
  const randomSetup = useCallback(async () => {
    if (!playerColor) return;
    
    console.log('🎲 Starting random setup...');
    
    // Get all valid setup positions for this player
    const validPositions: [number, number][] = [];
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 10; col++) {
        if (isSetupArea(row, playerColor) && !isLakePosition(row, col) && !gameState.board[row][col]) {
          validPositions.push([row, col]);
        }
      }
    }
    
    console.log(`📍 Found ${validPositions.length} valid empty positions for random setup`);
    
    // Get remaining pieces that need to be placed
    const remainingPieces: { rank: PieceRank; count: number }[] = [];
    Object.entries(availablePieces).forEach(([rank, count]) => {
      if (count > 0) {
        remainingPieces.push({ rank: rank as PieceRank, count });
      }
    });
    
    console.log('🎲 Remaining pieces to place:', remainingPieces);
    
    if (remainingPieces.length === 0) {
      setError('All pieces are already placed!');
      setTimeout(() => setError(null), 3000);
      return;
    }
    
    if (validPositions.length < remainingPieces.reduce((sum, { count }) => sum + count, 0)) {
      setError('Not enough empty positions for all remaining pieces!');
      setTimeout(() => setError(null), 3000);
      return;
    }
    
    // Shuffle valid positions for random placement
    const shuffledPositions = [...validPositions].sort(() => Math.random() - 0.5);
    
    const newBoard = [...gameState.board];
    const newAvailablePieces = { ...availablePieces };
    const newUsedVariants = new Set(usedPieceVariants);
    
    let positionIndex = 0;
    
    // Place each remaining piece randomly
    for (const { rank, count } of remainingPieces) {
      for (let i = 0; i < count; i++) {
        if (positionIndex >= shuffledPositions.length) {
          console.error('❌ Ran out of valid positions for random setup!');
          break;
        }
        
        const [row, col] = shuffledPositions[positionIndex];
        positionIndex++;
        
        // Generate random variant for pieces with multiple copies
        let imagePath: string;
        if (PIECE_COUNTS[rank] === 1) {
          imagePath = `/images/stratego/pieces/${playerColor}-${rank.toLowerCase()}.png`;
        } else {
          // Find an unused variant
          let variantNumber = 1;
          do {
            imagePath = `/images/stratego/pieces/${playerColor}-${rank.toLowerCase()}-${variantNumber}.png`;
            variantNumber++;
          } while (newUsedVariants.has(imagePath) && variantNumber <= PIECE_COUNTS[rank]);
        }
        
        // Place the piece
        newBoard[row][col] = {
          color: playerColor,
          rank: rank,
          isRevealed: false,
          canMove: rank !== 'Bomb' && rank !== 'Flag',
          imagePath: imagePath
        };
        
        newUsedVariants.add(imagePath);
        newAvailablePieces[rank]--;
        
        console.log(`🎲 Random placed ${rank} at [${row}, ${col}] with image ${imagePath}`);
      }
    }
    
    // Update state
    const newState = {
      ...gameState,
      board: newBoard
    };
    
    setGameState(newState);
    setAvailablePieces(newAvailablePieces);
    setUsedPieceVariants(newUsedVariants);
    
    // Save state to database
    await saveGameState(newState);
    
    console.log('✅ Random setup complete!');
    
    const totalPlaced = remainingPieces.reduce((sum, { count }) => sum + count, 0);
    setError(`🎲 Randomly placed ${totalPlaced} pieces! Ready to battle!`);
    setTimeout(() => setError(null), 5000);
    
  }, [playerColor, gameState, availablePieces, usedPieceVariants, saveGameState]);

  // Mark player as ready
  const markPlayerReady = useCallback(async () => {
    if (!playerColor) return;
    
    // Check if all pieces are placed by counting pieces ON THE BOARD for your color
    const yourPiecesOnBoard = gameState.board.flat().filter(piece => piece && piece.color === playerColor).length;
    const totalPiecesRequired = 40;
    
    console.log(`🔍 Ready check: ${yourPiecesOnBoard} pieces on board vs ${totalPiecesRequired} required`);
    
    if (yourPiecesOnBoard < totalPiecesRequired) {
      setError(`Please place all pieces before marking ready! (${yourPiecesOnBoard}/${totalPiecesRequired})`);
      return;
    }
    
    const newState = {
      ...gameState,
      [playerColor === 'red' ? 'redPlayerReady' : 'bluePlayerReady']: true
    };
    
    // Check if both players are ready
    const bothReady = (playerColor === 'red' ? newState.bluePlayerReady : newState.redPlayerReady) && true;
    
    if (bothReady) {
      // Start the game!
      newState.setupPhase = false;
      newState.gameStatus = 'active';
      console.log('🚀 Both players ready - starting game!');
    }
    
    setGameState(newState);
    await saveGameState(newState);
    
    if (bothReady) {
      setError('🎉 Both players ready - Battle begins!');
      setTimeout(() => setError(null), 3000);
    } else {
      setError(`✅ You are ready! Waiting for opponent...`);
      setTimeout(() => setError(null), 3000);
    }
  }, [playerColor, gameState, saveGameState]);

  // Get symbol for piece rank (fallback if image fails)
  const getPieceSymbol = (rank: PieceRank): string => {
    const symbols: Record<PieceRank, string> = {
      'Marshal': '⭐',
      'General': '🎖️',
      'Colonel': '��',
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

  // Get visual coordinates for display (blue player sees flipped board)
  const getVisualCoordinates = (row: number, col: number): [number, number] => {
    if (playerColor === 'blue') {
      return [9 - row, col]; // Flip rows for blue player
    }
    return [row, col]; // Normal for red player
  };

  // Render a square
  const renderSquare = (actualRow: number, actualCol: number) => {
    const [visualRow, visualCol] = getVisualCoordinates(actualRow, actualCol);
    const piece = gameState.board[actualRow][actualCol];
    const isSelected = selectedSquare && selectedSquare[0] === actualRow && selectedSquare[1] === actualCol;
    const isValidMove = validMoves.some(([r, c]) => r === actualRow && c === actualCol);
    const isLake = isLakePosition(actualRow, actualCol);
    const isSetupAreaForPlayer = playerColor && isSetupArea(actualRow, playerColor);
    const isLastMoveSquare = gameState.lastMove && 
      ((gameState.lastMove.from[0] === actualRow && gameState.lastMove.from[1] === actualCol) ||
       (gameState.lastMove.to[0] === actualRow && gameState.lastMove.to[1] === actualCol));
    
    const bgColor = isLake ? '#4169E1' : '#F5DEB3';
    const selectedSquareStyle = isSelected ? { boxShadow: 'inset 0 0 0 3px #FFD700' } : {};
    const getCursor = (row: number, col: number): string => {
      if (gameState.setupPhase && gameState.board[row][col] && gameState.board[row][col]!.color === playerColor) {
        return 'pointer';
      }
      return 'default';
    };
    
    return (
      <div
        key={`${actualRow}-${actualCol}`}
        className={`stratego-square ${isLake ? 'lake' : ''} ${isSelected ? 'selected' : ''} ${isValidMove ? 'valid-move' : ''} ${isLastMoveSquare ? 'last-move' : ''} ${gameState.setupPhase && isSetupAreaForPlayer ? 'setup-area' : ''}`}
        style={{
          width: '100%',
          height: '100%',
          gridColumn: visualCol + 1,
          gridRow: visualRow + 1,
          backgroundColor: bgColor,
          border: '1px solid #444',
          cursor: getCursor(actualRow, actualCol),
          position: 'relative',
          ...selectedSquareStyle
        }}
        onClick={() => handleSquareClick(actualRow, actualCol)}
        onContextMenu={(e) => {
          e.preventDefault();
          if (gameState.setupPhase && gameState.board[actualRow][actualCol] && gameState.board[actualRow][actualCol]!.color === playerColor) {
            removePiece(actualRow, actualCol);
          }
        }}
      >
        {isLake && <span style={{ fontSize: '24px', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>🌊</span>}
        {piece && (
          (() => {
            // DURING SETUP: Only show your own pieces 
            // DURING ACTIVE: Show all pieces (yours normal, opponent's hidden/revealed)
            const shouldShowPiece = gameState.setupPhase ? (piece.color === playerColor) : true;
            
            if (!shouldShowPiece) {
              // During setup, if it's opponent piece, show hidden back
              return (
                <Image
                  src={`/images/stratego/pieces/${piece.color}-hidden.png`}
                  alt="Hidden piece"
                  fill
                  style={{
                    objectFit: 'contain',
                  }}
                  priority={true}
                  unoptimized={true}
                />
              );
            }
            
            return (
              <Image
                src={getDisplayImageForPiece(piece)}
                alt={piece.isRevealed || piece.color === playerColor ? piece.rank : 'Hidden piece'}
                fill
                style={{
                  objectFit: 'contain',
                }}
                priority={true}
                unoptimized={true}
              />
            );
          })()
        )}
      </div>
    );
  };

  // Fetch escrow status
  const fetchEscrowStatus = useCallback(async () => {
    if (!publicKey) return;
    
    try {
      const response = await fetch(`/api/games/${gameId}/escrow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_escrow_status',
          playerWallet: publicKey.toString()
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setEscrowStatus(data);
      }
    } catch (error) {
      console.error('Error fetching escrow status:', error);
    }
  }, [gameId, publicKey]);

  // Initialize MagicBlock session
  const initializeMagicBlockSession = useCallback(async () => {
    if (!publicKey || !signTransaction || gameState.gameStatus !== 'active') return;

    try {
      const gameStateAccount = new PublicKey('11111111111111111111111111111111');
      
      const result = await magicBlockManager.initializeGameSession(
        gameId,
        gameStateAccount,
        publicKey,
        signTransaction
      );

      if (result.success) {
        setEphemeralSession(result.ephemeralSession || null);
      }
    } catch (error) {
      console.error('MagicBlock initialization failed:', error);
    }
  }, [publicKey, signTransaction, gameState.gameStatus, gameId]);

  // Initialize game state
  const initializeGameState = useCallback(async () => {
    if (!publicKey || isInitialized) {
      console.log('🚫 Skipping initialization:', { publicKey: !!publicKey, isInitialized });
      return;
    }
    
    console.log('🔄 Initializing game state...');
    setIsInitialized(true);
    
    try {
      const gameResponse = await fetch(`/api/games/${gameId}`);
      if (gameResponse.ok) {
        const gameData = await gameResponse.json();
        const walletAddress = publicKey.toString();
        
        if (gameData.players && gameData.players.length >= 1) {
          const currentPlayer = gameData.players.find((p: { id: string; wallet_address: string }) => p.wallet_address === walletAddress);
          if (currentPlayer) {
            setCurrentPlayerId(currentPlayer.id);
            
            if (gameData.players[0]?.wallet_address === walletAddress) {
              setPlayerColor('red');
            } else if (gameData.players[1]?.wallet_address === walletAddress) {
              setPlayerColor('blue');
            }
          }
          
          let gameStatus: 'waiting' | 'setup' | 'active' | 'finished';
          if (gameData.status === 'in_progress') {
            gameStatus = 'setup'; // Start with setup phase
          } else if (gameData.status === 'finished') {
            gameStatus = 'finished';
          } else {
            gameStatus = gameData.players.length >= 2 ? 'setup' : 'waiting';
          }
          
          // Try to load saved game state like checkers
          let restoredBoard = Array(10).fill(null).map(() => Array(10).fill(null));
          const restoredAvailablePieces = { ...PIECE_COUNTS };
          const restoredUsedVariants = new Set<string>();
          let savedStateData: Partial<GameState> | null = null; // Declare here for later use
          
          try {
            const stateResponse = await fetch(`/api/games/${gameId}/state`);
            if (stateResponse.ok) {
              savedStateData = await stateResponse.json();
              console.log('🔄 Restoring saved game state:', savedStateData);
              
              if (savedStateData && savedStateData.board) {
                restoredBoard = savedStateData.board;
                
                // Count ALL pieces on the board for debugging
                const redPieces = restoredBoard.flat().filter(p => p && p.color === 'red').length;
                const bluePieces = restoredBoard.flat().filter(p => p && p.color === 'blue').length;
                console.log(`🔍 RESTORED BOARD: Red pieces: ${redPieces}, Blue pieces: ${bluePieces}, Total: ${redPieces + bluePieces}`);
                
                // Recalculate available pieces based ONLY on YOUR placed pieces
                const yourColor = gameData.players[0]?.wallet_address === walletAddress ? 'red' : 'blue';
                const placedPieces: Record<PieceRank, number> = {
                  'Marshal': 0,
                  'General': 0,
                  'Colonel': 0,
                  'Major': 0,
                  'Captain': 0,
                  'Lieutenant': 0,
                  'Sergeant': 0,
                  'Miner': 0,
                  'Scout': 0,
                  'Spy': 0,
                  'Bomb': 0,
                  'Flag': 0
                };
                
                // Count placed pieces and track used variants - ONLY FOR YOUR COLOR
                for (let row = 0; row < 10; row++) {
                  for (let col = 0; col < 10; col++) {
                    const piece = restoredBoard[row][col];
                    if (piece && piece.color === yourColor) {
                      placedPieces[piece.rank as PieceRank]++;
                      if (piece.imagePath) {
                        restoredUsedVariants.add(piece.imagePath);
                      }
                    }
                  }
                }
                
                // Update available pieces - ONLY FOR YOUR COLOR
                Object.keys(PIECE_COUNTS).forEach(rank => {
                  const rankKey = rank as PieceRank;
                  restoredAvailablePieces[rankKey] = PIECE_COUNTS[rankKey] - placedPieces[rankKey];
                });
                
                console.log('✅ Restored YOUR pieces:', placedPieces);
                console.log('✅ Restored available pieces:', restoredAvailablePieces);
                console.log('✅ Restored used variants:', restoredUsedVariants);
              }
            }
          } catch {
            console.log('No saved state found, starting fresh');
          }
          
          const newState: GameState = {
            board: restoredBoard,
            currentPlayer: savedStateData?.currentPlayer || 'red',
            redPlayer: gameData.players[0]?.wallet_address || null,
            bluePlayer: gameData.players[1]?.wallet_address || null,
            gameStatus,
            winner: savedStateData?.winner || null,
            setupPhase: savedStateData?.setupPhase !== undefined ? savedStateData.setupPhase : (gameStatus === 'setup'),
            setupTimeLeft: SETUP_TIME_LIMIT,
            turnTimeLeft: TURN_TIME_LIMIT,
            // LOAD READY STATES FROM SAVED DATA
            redPlayerReady: savedStateData?.redPlayerReady || false,
            bluePlayerReady: savedStateData?.bluePlayerReady || false,
          };
          
          if (newState.gameStatus === 'setup' && !gameStartTime) {
            setGameStartTime(gameData.started_at ? new Date(gameData.started_at) : new Date());
          }
          
          setGameState(newState);
          setAvailablePieces(restoredAvailablePieces);
          setUsedPieceVariants(restoredUsedVariants);
          
          // Only save state if we're in setup and have no saved state
          if (gameStatus === 'setup' && restoredBoard.every(row => row.every(cell => cell === null))) {
            console.log('💾 Saving initial fresh state');
            await saveGameState(newState);
          }
        }
      }
    } catch (error) {
      console.error('Error initializing game:', error);
      setIsInitialized(false); // Reset on error
    }
  }, [gameId, publicKey, gameStartTime, saveGameState, isInitialized]);

  // Initialize on mount
  useEffect(() => {
    if (publicKey && !isInitialized) {
      console.log('🚀 Starting initialization for wallet:', publicKey.toString());
      initializeGameState();
      fetchEscrowStatus();
    }
  }, [publicKey, isInitialized, initializeGameState, fetchEscrowStatus]);
  
  // Reset initialization when wallet changes
  useEffect(() => {
    setIsInitialized(false);
  }, [publicKey]);

  // Update game completion
  useEffect(() => {
    if (gameState.winner && gameState.gameStatus === 'finished') {
      console.log('🏁 Game finished, completing...', gameState.winner);
      
      // Store winner at the exact moment of detection to prevent timing issues
      setGameEndWinner(gameState.winner);
      
      completeGame(gameState.winner).then(() => {
        setGameEndDialog(true);
      });
    }
  }, [gameState.winner, gameState.gameStatus, completeGame]);

  // Initialize MagicBlock when game becomes active
  useEffect(() => {
    if (gameState.gameStatus === 'active' && publicKey && signTransaction) {
      initializeMagicBlockSession();
    }
  }, [gameState.gameStatus, publicKey, signTransaction, initializeMagicBlockSession]);

  // Periodic board state refresh during active gameplay
  useEffect(() => {
    if (gameState.gameStatus === 'active' && !gameState.setupPhase) {
      console.log('🔄 Setting up board state refresh for active gameplay');
      
      const refreshBoardState = async () => {
        try {
          console.log('🔄 Refreshing board state...');
          const stateResponse = await fetch(`/api/games/${gameId}/state`);
          if (stateResponse.ok) {
            const savedState = await stateResponse.json();
            if (savedState.board) {
              // Count pieces before update
              const currentTotal = gameState.board.flat().filter((p: StrategoPiece | null) => p !== null).length;
              const newTotal = savedState.board.flat().filter((p: StrategoPiece | null) => p !== null).length;
              
              // COMPREHENSIVE STATE UPDATE - sync ALL game state
              const stateChanged = (
                newTotal !== currentTotal ||
                savedState.currentPlayer !== gameState.currentPlayer ||
                savedState.redPlayerReady !== gameState.redPlayerReady ||
                savedState.bluePlayerReady !== gameState.bluePlayerReady ||
                savedState.setupPhase !== gameState.setupPhase ||
                savedState.gameStatus !== gameState.gameStatus
              );
              
              if (stateChanged) {
                console.log(`🔄 Game state changed! Syncing all state...`, {
                  pieces: `${currentTotal} → ${newTotal}`,
                  currentPlayer: `${gameState.currentPlayer} → ${savedState.currentPlayer}`,
                  redReady: `${gameState.redPlayerReady} → ${savedState.redPlayerReady}`,
                  blueReady: `${gameState.bluePlayerReady} → ${savedState.bluePlayerReady}`,
                  setupPhase: `${gameState.setupPhase} → ${savedState.setupPhase}`,
                  gameStatus: `${gameState.gameStatus} → ${savedState.gameStatus}`
                });
                
                setGameState(prev => ({
                  ...prev,
                  board: savedState.board,
                  currentPlayer: savedState.currentPlayer || prev.currentPlayer,
                  redPlayerReady: savedState.redPlayerReady !== undefined ? savedState.redPlayerReady : prev.redPlayerReady,
                  bluePlayerReady: savedState.bluePlayerReady !== undefined ? savedState.bluePlayerReady : prev.bluePlayerReady,
                  setupPhase: savedState.setupPhase !== undefined ? savedState.setupPhase : prev.setupPhase,
                  gameStatus: savedState.gameStatus || prev.gameStatus,
                  turnTimeLeft: savedState.turnTimeLeft || prev.turnTimeLeft,
                  winner: savedState.winner || prev.winner
                }));
              }
            }
          }
        } catch (error) {
          console.error('❌ Failed to refresh board state:', error);
        }
      };

      // Refresh immediately and then every 5 seconds
      refreshBoardState();
      const interval = setInterval(refreshBoardState, 5000);

      return () => {
        console.log('🛑 Stopping board state refresh');
        clearInterval(interval);
      };
    }
  }, [gameState.gameStatus, gameState.setupPhase, gameId, gameState.board, gameState.currentPlayer, gameState.redPlayerReady, gameState.bluePlayerReady]);

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', p: 3 }}>
      {/* Game Info */}
      <Paper sx={{ p: 2, mb: 3, bgcolor: '#2E4057', color: 'white', borderRadius: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h4" align="center" sx={{ fontWeight: 'bold', flex: 1 }}>
            🎖️ Stratego Battle 🎖️
          </Typography>
          
          {/* Forfeit Button - Always visible during setup and active gameplay */}
          {(gameState.gameStatus === 'active' || gameState.setupPhase) && playerColor && (
            <Button
              variant="outlined"
              color="error"
              onClick={() => setShowForfeitDialog(true)}
              sx={{ 
                borderColor: '#d32f2f', 
                color: '#d32f2f',
                bgcolor: 'rgba(211, 47, 47, 0.1)',
                '&:hover': { 
                  bgcolor: 'rgba(211, 47, 47, 0.2)',
                  borderColor: '#b71c1c'
                },
                minWidth: 'auto',
                px: 2
              }}
            >
              🏳️ Forfeit
            </Button>
          )}
        </Box>
        
        {/* Timer Display */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          {gameState.setupPhase ? (
            <Paper sx={{ p: 1, bgcolor: gameState.setupTimeLeft < 60000 ? '#d32f2f' : '#2e7d32', color: 'white' }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                🏗️ Setup: {formatTime(gameState.setupTimeLeft)}
                {gameState.setupTimeLeft < 30000 && gameState.setupTimeLeft > 0 && 
                 Object.values(availablePieces).some(count => count > 0) && (
                  <Typography variant="caption" sx={{ display: 'block', fontSize: '0.7rem' }}>
                    ⚠️ Remaining pieces will be auto-placed when timer expires!
                  </Typography>
                )}
              </Typography>
            </Paper>
          ) : gameState.gameStatus === 'active' ? (
            <Paper sx={{ p: 1, bgcolor: gameState.turnTimeLeft < 10000 ? '#d32f2f' : '#2e7d32', color: 'white' }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                ⏰ Turn: {formatTime(gameState.turnTimeLeft)}
              </Typography>
            </Paper>
          ) : null}
          {escrowStatus && (
            <Paper sx={{ p: 1, mx: 1, bgcolor: '#ff9800', color: 'white' }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                💰 Pot: {escrowStatus.totalEscrowed.toFixed(4)} SOL
              </Typography>
            </Paper>
          )}
          {ephemeralSession && realTimeMoves > 0 && (
            <Paper sx={{ p: 1, mx: 1, bgcolor: '#4caf50', color: 'white' }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                ⚡ {moveLatency}ms | {realTimeMoves} moves
              </Typography>
            </Paper>
          )}
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
              🏗️ Deploy Your Army! Click empty squares to place pieces, click pieces to remove them.
            </Typography>
            
            {/* READY STATUS DISPLAY */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2">
                🔴 Red Player: {gameState.redPlayerReady ? '✅ Ready' : '⏳ Setting up...'}
              </Typography>
              <Typography variant="body2">
                🔵 Blue Player: {gameState.bluePlayerReady ? '✅ Ready' : '⏳ Setting up...'}
              </Typography>
            </Box>
            
            {/* SETUP BUTTONS */}
            {playerColor && !gameState[playerColor === 'red' ? 'redPlayerReady' : 'bluePlayerReady'] && (
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mb: 2 }}>
                {/* Random Setup Button */}
                {Object.values(availablePieces).some(count => count > 0) && (
                  <Button
                    variant="outlined"
                    onClick={randomSetup}
                    sx={{ 
                      borderColor: '#ff9800',
                      color: '#ff9800',
                      '&:hover': { 
                        bgcolor: 'rgba(255, 152, 0, 0.1)',
                        borderColor: '#f57c00'
                      },
                      fontWeight: 'bold'
                    }}
                    size="large"
                  >
                    🎲 Random Setup
                  </Button>
                )}
                
                {/* Ready Button */}
                <Button
                  variant="contained"
                  onClick={markPlayerReady}
                  sx={{ 
                    bgcolor: '#4caf50', 
                    '&:hover': { bgcolor: '#388e3c' },
                    fontWeight: 'bold'
                  }}
                  size="large"
                >
                  ✅ Ready to Battle!
                </Button>
              </Box>
            )}
            
            {playerColor && gameState[playerColor === 'red' ? 'redPlayerReady' : 'bluePlayerReady'] && (
              <Typography variant="h6" sx={{ 
                bgcolor: '#4caf50',
                color: 'white',
                p: 1,
                borderRadius: 1,
                fontWeight: 'bold',
                mb: 2
              }}>
                ✅ You are ready! Waiting for opponent...
              </Typography>
            )}
            
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
        {/* Game Board - Centered */}
        <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <div className="stratego-board">
            {/* DEBUG: Log board state */}
            {(() => {
              const totalPieces = gameState.board.flat().filter(p => p !== null).length;
              const yourPieces = gameState.board.flat().filter(p => p && p.color === playerColor).length;
              const opponentPieces = gameState.board.flat().filter(p => p && p.color !== playerColor).length;
              console.log(`🎮 BOARD STATE: Status=${gameState.gameStatus}, Setup=${gameState.setupPhase}, You=${playerColor}, Total=${totalPieces}, Yours=${yourPieces}, Opponent=${opponentPieces}`);
              return null;
            })()}
            {gameState.board.map((row, rowIndex) =>
              row.map((_, colIndex) => renderSquare(rowIndex, colIndex))
            )}
          </div>
        </Box>
      </Box>

      {/* Piece Selector Modal */}
      <Dialog 
        open={showPieceSelector} 
        onClose={() => setShowPieceSelector(false)} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle sx={{ textAlign: 'center', fontSize: '1.5rem', fontWeight: 'bold' }}>
          🎯 Choose Your Piece
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" align="center" gutterBottom>
            {selectedSetupSquare && `Placing piece at position ${selectedSetupSquare[0]}, ${selectedSetupSquare[1]}`}
          </Typography>
          
          {/* Piece Carousel - 5x3 GRID WITH PAGINATION */}
          <Box sx={{ position: 'relative', width: '100%' }}>
            {/* Page Navigation */}
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
              <IconButton
                onClick={() => setCarouselPage(prev => Math.max(0, prev - 1))}
                disabled={carouselPage === 0}
                sx={{
                  bgcolor: 'rgba(46, 64, 87, 0.8)',
                  color: 'white',
                  '&:hover': { bgcolor: 'rgba(46, 64, 87, 1)' },
                  '&:disabled': { bgcolor: 'rgba(46, 64, 87, 0.3)' }
                }}
              >
                <ArrowBackIos />
              </IconButton>
              
              <Typography variant="h6" sx={{ mx: 2, alignSelf: 'center' }}>
                Page {carouselPage + 1} of {Math.ceil(allPieceVariants.length / 12)}
              </Typography>
              
              <IconButton
                onClick={() => setCarouselPage(prev => Math.min(Math.ceil(allPieceVariants.length / 12) - 1, prev + 1))}
                disabled={carouselPage >= Math.ceil(allPieceVariants.length / 12) - 1}
                sx={{
                  bgcolor: 'rgba(46, 64, 87, 0.8)',
                  color: 'white',
                  '&:hover': { bgcolor: 'rgba(46, 64, 87, 1)' },
                  '&:disabled': { bgcolor: 'rgba(46, 64, 87, 0.3)' }
                }}
              >
                <ArrowForwardIos />
              </IconButton>
            </Box>

            {/* 4x3 Grid Container - ZERO PADDING MAXIMUM SIZE PIECES */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)', // 4 columns for maximum width usage
                gridTemplateRows: 'repeat(3, 1fr)', // 3 rows for bigger height per piece
                gap: 0, // ZERO gap for maximum piece size
                py: 0, // ZERO padding
                px: 0, // ZERO padding
                minHeight: 600, // Shorter container with 3 rows
                width: '100%'
              }}
            >
              {/* Render current page of pieces (12 pieces per page in 4x3 grid) */}
              {allPieceVariants
                .slice(carouselPage * 12, (carouselPage + 1) * 12) // 12 pieces per page now
                .map((variant) => (
                                     <Box 
                     key={`${variant.rank}-${variant.imagePath}`} 
                     onClick={() => variant.available && placePiece(variant.rank, variant.imagePath)}
                     sx={{ 
                       cursor: variant.available ? 'pointer' : 'not-allowed',
                       opacity: variant.available ? 1 : 0.6,
                       transition: 'all 0.2s ease',
                       '&:hover': variant.available ? { 
                         transform: 'scale(1.05)', // Smaller scale to avoid overlap with zero gaps
                         zIndex: 10,
                         filter: 'drop-shadow(0 8px 16px rgba(255, 215, 0, 0.4))'
                       } : {},
                       height: '100%',
                       width: '100%',
                       position: 'relative'
                     }}
                   >
                                         {/* RECTANGULAR PIECE CONTAINER - PURE ARTWORK! */}
                     <Box
                       sx={{
                         width: '100%',
                         height: '100%', // Use ALL available space for the piece
                         display: 'flex',
                         alignItems: 'center',
                         justifyContent: 'center',
                         position: 'relative',
                         // NO BORDERS, NO BACKGROUND, NO TEXT - JUST PURE PIECE ARTWORK!
                       }}
                     >
                       <Image
                         src={variant.imagePath}
                         alt={variant.displayName}
                         fill
                         style={{
                           objectFit: 'contain', // Maintain piece proportions
                           filter: variant.available ? 'none' : 'grayscale(80%) brightness(0.7)',
                         }}
                         priority={true}
                         unoptimized={true}
                       />
                     </Box>
                  </Box>
                ))}
            </Box>
          </Box>
          
          <Box sx={{ mt: 3, p: 2, bgcolor: 'rgba(46, 64, 87, 0.1)', borderRadius: 1 }}>
            <Typography variant="h6" gutterBottom>
              🎖️ Remaining Pieces Summary
            </Typography>
            <Typography variant="body2">
              Total remaining: {Object.values(availablePieces).reduce((sum, count) => sum + count, 0)} / 40
            </Typography>
            {Object.values(availablePieces).reduce((sum, count) => sum + count, 0) === 0 && (
              <Button
                variant="contained"
                fullWidth
                onClick={markPlayerReady}
                sx={{ mt: 2, bgcolor: '#4caf50', '&:hover': { bgcolor: '#388e3c' } }}
              >
                ✅ Ready to Battle!
              </Button>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPieceSelector(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>

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

      {/* Forfeit Dialog */}
      <Dialog open={showForfeitDialog} onClose={() => setShowForfeitDialog(false)}>
        <DialogTitle>Forfeit Game</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to forfeit? Your opponent will automatically win and receive the SOL payout.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowForfeitDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleForfeit} 
            color="error" 
            variant="contained"
            disabled={forfeitLoading}
          >
            {forfeitLoading ? <CircularProgress size={20} /> : 'Forfeit'}
          </Button>
        </DialogActions>
      </Dialog>



      {/* GameEndModal for SOL payouts */}
      <GameEndModal
        open={gameEndDialog}
        winner={gameEndWinner || gameState.winner ? {
          username: (gameEndWinner || gameState.winner) === 'red' ? 'Red Army' : 'Blue Army',
          walletAddress: (gameEndWinner || gameState.winner) === 'red' ? 
            gameState.redPlayer || '' : gameState.bluePlayer || ''
        } : undefined}
        onClose={() => {
          setGameEndDialog(false);
          setGameEndWinner(null);
        }}
        totalPot={escrowStatus?.totalEscrowed || 0}
                              escrowReleased={!!payoutSignature}
          escrowTransactionSignature={payoutSignature || undefined}
          winnerAmount={payoutAmount}
          platformFee={0}
      />

      <style jsx>{`
        .stratego-board {
          display: grid;
          grid-template-columns: repeat(10, 100px);
          grid-template-rows: repeat(10, 100px);
          gap: 1px;
          border: 4px solid #2E4057;
          border-radius: 8px;
          background-color: #2E4057;
          width: fit-content;
          margin: 0 auto;
          padding: 2px;
          box-sizing: border-box;
        }
        
        .stratego-square {
          width: 100px;
          height: 100px;
          position: relative;
          overflow: visible; /* Allow hover effects to extend beyond square */
        }
        
        .stratego-square.selected {
          box-shadow: inset 0 0 0 3px #FFD700;
        }
        
        .stratego-square.valid-move {
          box-shadow: inset 0 0 0 2px #FFA500;
        }
        
        .stratego-square.last-move {
          box-shadow: inset 0 0 0 2px #87CEEB;
        }
        
        .stratego-square.setup-area {
          background-color: rgba(144, 238, 144, 0.3) !important;
        }
        
        .stratego-square:hover:not(.lake) {
          transform: scale(1.08);
          transition: transform 0.2s ease;
          z-index: 5;
        }
        
        .stratego-square:hover:not(.lake) img {
          transform: scale(1.1);
          transition: transform 0.2s ease;
        }

        /* Mobile Responsive */
        @media (max-width: 600px) {
          .stratego-board {
            grid-template-columns: repeat(10, 80px);
            grid-template-rows: repeat(10, 80px);
            gap: 1px;
            padding: 2px;
            border-width: 3px;
          }
          
          .stratego-square {
            width: 80px;
            height: 80px;
          }
        }

        /* Large screen optimization */
        @media (min-width: 1200px) {
          .stratego-board {
            grid-template-columns: repeat(10, 120px);
            grid-template-rows: repeat(10, 120px);
            gap: 2px;
            padding: 4px;
          }
          
          .stratego-square {
            width: 120px;
            height: 120px;
          }
        }
      `}</style>
    </Box>
  );
};