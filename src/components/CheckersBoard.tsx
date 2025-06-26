'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions, Paper, Alert } from '@mui/material';
import { PublicKey } from '@solana/web3.js';
import { magicBlockManager, GameMove } from '../lib/magicblock';

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

// Add time limit constant
const GAME_TIME_LIMIT = 15 * 60 * 1000; // 15 minutes in milliseconds

// Initialize a standard checkers board (plain function for initial state)
function createInitialBoard(): (GamePiece | null)[][] {
  const board: (GamePiece | null)[][] = Array(8).fill(null).map(() => Array(8).fill(null));
  
  // Place black pieces (top 3 rows)
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2 === 1) {
        board[row][col] = { type: 'black', isKing: false };
      }
    }
  }
  
  // Place red pieces (bottom 3 rows)
  for (let row = 5; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2 === 1) {
        board[row][col] = { type: 'red', isKing: false };
      }
    }
  }
  
  return board;
}

export const CheckersBoard: React.FC<CheckersBoardProps> = ({ gameId }) => {
  const { publicKey, signTransaction } = useWallet();
  const [gameState, setGameState] = useState<GameState>(() => ({
    board: Array(8).fill(null).map(() => Array(8).fill(null)),
    currentPlayer: 'red',
    redPlayer: null,
    blackPlayer: null,
    gameStatus: 'waiting',
    winner: null,
  }));
  
  const [selectedSquare, setSelectedSquare] = useState<[number, number] | null>(null);
  const [validMoves, setValidMoves] = useState<[number, number][]>([]);
  const [playerColor, setPlayerColor] = useState<Player | null>(null);
  const [gameEndDialog, setGameEndDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(GAME_TIME_LIMIT);
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

  // MagicBlock state for real-time moves
  const [ephemeralSession, setEphemeralSession] = useState<string | null>(null);
  const [moveLatency, setMoveLatency] = useState<number>(0);
  const [realTimeMoves, setRealTimeMoves] = useState<number>(0);

  // Initialize MagicBlock session when game becomes active
  const initializeMagicBlockSession = useCallback(async () => {
    if (!publicKey || !signTransaction || gameState.gameStatus !== 'active') return;

    try {
      console.log('🚀 Initializing MagicBlock session for real-time moves...');
      
      // Create deterministic game state account
      const gameStateAccount = new PublicKey('11111111111111111111111111111111');
      
      const result = await magicBlockManager.initializeGameSession(
        gameId,
        gameStateAccount,
        publicKey,
        signTransaction
      );

      if (result.success) {
        setEphemeralSession(result.ephemeralSession || null);
        console.log('✅ MagicBlock session ready for instant moves!');
      }
    } catch (error) {
      console.error('⚠️ MagicBlock initialization failed, falling back to mainnet:', error);
      // Game continues normally on mainnet if MagicBlock fails
    }
  }, [publicKey, signTransaction, gameState.gameStatus, gameId]);

  // Save game state to API (using existing game state endpoint)
  const saveGameState = useCallback(async (state: GameState) => {
    if (!publicKey || !currentPlayerId) return;
    
    try {
      console.log('Saving game state:', state);
      const response = await fetch(`/api/games/${gameId}/state`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newState: state,
          playerId: currentPlayerId
        })
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('Failed to save game state. Status:', response.status, 'Error:', errorData);
        setError(`Failed to save game state: ${response.status}`);
      } else {
        const result = await response.json();
        console.log('Game state saved successfully:', result);
        
        // Clear any existing errors on successful save
        if (error) setError(null);
      }
    } catch (error) {
      console.error('Error saving game state:', error);
      setError('Failed to save game state: Network error');
    }
  }, [gameId, publicKey, currentPlayerId, error]);

  // Initialize game state when needed
  const initializeGameState = useCallback(async () => {
    if (!publicKey) return;
    
    try {
      const gameResponse = await fetch(`/api/games/${gameId}`);
      if (gameResponse.ok) {
        const gameData = await gameResponse.json();
        const walletAddress = publicKey.toString();
        
        console.log('Game data received:', gameData);
        console.log('Game status from API:', gameData.status);
        console.log('Number of players:', gameData.players?.length);
        
        if (gameData.players && gameData.players.length >= 1) {
          // Find the current player's ID and set player color
          const currentPlayer = gameData.players.find((p: { id: string; wallet_address: string }) => p.wallet_address === walletAddress);
          if (currentPlayer) {
            setCurrentPlayerId(currentPlayer.id);
            
            // Determine player color based on position in players array
            if (gameData.players[0]?.wallet_address === walletAddress) {
              setPlayerColor('red');
            } else if (gameData.players[1]?.wallet_address === walletAddress) {
              setPlayerColor('black');
            }
          }
          
          // Determine game status - check both database status and player count
          let gameStatus: 'waiting' | 'active' | 'finished';
          if (gameData.status === 'in_progress') {
            gameStatus = 'active';
          } else if (gameData.status === 'finished') {
            gameStatus = 'finished';
          } else {
            // If not started yet, check if we have enough players
            gameStatus = gameData.players.length >= 2 ? 'waiting' : 'waiting';
          }
          
          console.log('Determined game status:', gameStatus);
          
          const newState: GameState = {
            board: createInitialBoard(),
            currentPlayer: 'red' as Player,
            redPlayer: gameData.players[0]?.wallet_address || null,
            blackPlayer: gameData.players[1]?.wallet_address || null,
            gameStatus,
            winner: null,
          };
          
          // Set game start time if game is active
          if (newState.gameStatus === 'active' && !gameStartTime) {
            setGameStartTime(gameData.started_at ? new Date(gameData.started_at) : new Date());
          }
          
          setGameState(newState);
          
          // Only save state if game is active (to avoid overwriting existing state)
          if (gameStatus === 'active') {
            await saveGameState(newState);
          }
        }
      }
    } catch (error) {
      console.error('Error initializing game:', error);
    }
  }, [gameId, publicKey, gameStartTime, saveGameState]);

  // Fetch game state from API (using existing endpoint)
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
              
              console.log('Fetch game state - Game data:', gameData);
              console.log('Fetch game state - Game status:', gameData.status);
              
              if (gameData.players && gameData.players.length >= 2) {
                // First player = red, second player = black
                if (gameData.players[0].wallet_address === walletAddress) {
                  setPlayerColor('red');
                } else if (gameData.players[1].wallet_address === walletAddress) {
                  setPlayerColor('black');
                }
                
                // Update the game status based on current database status
                const currentState = data.currentState;
                if (gameData.status === 'in_progress' && currentState.gameStatus === 'waiting') {
                  console.log('🚀 Game status changed to active - updating local state');
                  const updatedState = {
                    ...currentState,
                    gameStatus: 'active' as const
                  };
                  setGameState(updatedState);
                  // Save the updated state
                  await saveGameState(updatedState);
                }
              }
            }
          }
        }
      } else if (response.status === 404) {
        // Game state doesn't exist yet, initialize it
        console.log('Game state not found, initializing...');
        await initializeGameState();
      }
    } catch (error) {
      console.error('Error fetching game state:', error);
      setError('Failed to load game state');
    }
  }, [gameId, publicKey, saveGameState, initializeGameState]);

  // Helper function to check for jumps from a specific position with a simulated board
  const getJumpsFromPosition = useCallback((row: number, col: number, piece: GamePiece, board: (GamePiece | null)[][], capturedPositions: Set<string> = new Set()): [number, number][] => {
    const jumpMoves: [number, number][] = [];
    
    const directions = piece.isKing 
      ? [[-1, -1], [-1, 1], [1, -1], [1, 1]] // Kings can jump in all directions
      : piece.type === 'red' 
        ? [[-1, -1], [-1, 1]] // Red moves up (toward row 0)
        : [[1, -1], [1, 1]]; // Black moves down (toward row 7)
    
    for (const [dr, dc] of directions) {
      const jumpRow = row + dr * 2;
      const jumpCol = col + dc * 2;
      const jumpedRow = row + dr;
      const jumpedCol = col + dc;
      
      if (jumpRow >= 0 && jumpRow < 8 && jumpCol >= 0 && jumpCol < 8) {
        const jumpedPiece = board[jumpedRow][jumpedCol];
        const destination = board[jumpRow][jumpCol];
        const jumpedPosKey = `${jumpedRow},${jumpedCol}`;
        
        // Can jump if there's an opponent piece to jump over, destination is empty, and we haven't already captured this piece in this sequence
        if (jumpedPiece && 
            jumpedPiece.type !== piece.type && 
            !destination && 
            !capturedPositions.has(jumpedPosKey)) {
          jumpMoves.push([jumpRow, jumpCol]);
        }
      }
    }
    
    return jumpMoves;
  }, []);

  // Get ALL possible jump sequences (multiple jumps) from a position
  const getAllJumpSequences = useCallback((startRow: number, startCol: number, piece: GamePiece): [number, number][][] => {
    const sequences: [number, number][][] = [];
    
    // Helper function to recursively find all jump sequences
    const findSequences = (currentRow: number, currentCol: number, currentPiece: GamePiece, board: (GamePiece | null)[][], sequence: [number, number][], capturedPositions: Set<string>) => {
      const possibleJumps = getJumpsFromPosition(currentRow, currentCol, currentPiece, board, capturedPositions);
      
      if (possibleJumps.length === 0) {
        // No more jumps possible, save this sequence if it has at least one jump
        if (sequence.length > 0) {
          sequences.push([...sequence]);
        }
        return;
      }
      
      // Try each possible jump
      for (const [jumpRow, jumpCol] of possibleJumps) {
        const jumpedRow = Math.floor((currentRow + jumpRow) / 2);
        const jumpedCol = Math.floor((currentCol + jumpCol) / 2);
        const jumpedPosKey = `${jumpedRow},${jumpedCol}`;
        
        // Create new board state for this jump
        const newBoard = board.map(row => [...row]);
        newBoard[jumpRow][jumpCol] = currentPiece;
        newBoard[currentRow][currentCol] = null;
        newBoard[jumpedRow][jumpedCol] = null;
        
        // Check for king promotion
        let newPiece = currentPiece;
        if (currentPiece.type && ((currentPiece.type === 'red' && jumpRow === 0) || (currentPiece.type === 'black' && jumpRow === 7))) {
          newPiece = { ...currentPiece, isKing: true };
          newBoard[jumpRow][jumpCol] = newPiece;
        }
        
        // Continue searching from the new position
        const newCapturedPositions = new Set(capturedPositions);
        newCapturedPositions.add(jumpedPosKey);
        
        findSequences(
          jumpRow, 
          jumpCol, 
          newPiece, 
          newBoard, 
          [...sequence, [jumpRow, jumpCol]], 
          newCapturedPositions
        );
      }
    };
    
    // Start the recursive search
    findSequences(startRow, startCol, piece, gameState.board, [], new Set());
    
    return sequences;
  }, [gameState.board, getJumpsFromPosition]);

  // Get valid moves for a piece - NOW WITH MULTIPLE JUMPS!
  const getValidMoves = useCallback((row: number, col: number, piece: GamePiece): [number, number][] => {
    const moves: [number, number][] = [];
    if (!piece) return moves;

    console.log(`Getting valid moves for ${piece.type} piece at (${row}, ${col})`);

    // Check for jump sequences first (mandatory in checkers)
    const jumpSequences = getAllJumpSequences(row, col, piece);
    
    if (jumpSequences.length > 0) {
      console.log(`Found ${jumpSequences.length} possible jump sequences:`, jumpSequences);
      
      // For UI purposes, we only show the first move of each possible sequence
      // The longest sequence will be automatically selected when the move is made
      const firstJumps = jumpSequences.map(sequence => sequence[0]);
      
      // Remove duplicates (multiple sequences might start with the same first jump)
      const uniqueFirstJumps = firstJumps.filter((jump, index, self) => 
        index === self.findIndex(j => j[0] === jump[0] && j[1] === jump[1])
      );
      
      console.log('Showing first jumps for UI:', uniqueFirstJumps);
      return uniqueFirstJumps;
    }
    
    // Only check regular moves if no jumps are available
    const directions = piece.isKing 
      ? [[-1, -1], [-1, 1], [1, -1], [1, 1]] // Kings can move in all directions
      : piece.type === 'red' 
        ? [[-1, -1], [-1, 1]] // Red moves up (toward row 0)
        : [[1, -1], [1, 1]]; // Black moves down (toward row 7)

    for (const [dr, dc] of directions) {
      const newRow = row + dr;
      const newCol = col + dc;
      
      // Check if destination is valid and empty
      if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8 && !gameState.board[newRow][newCol]) {
        console.log(`Regular move possible: (${newRow}, ${newCol})`);
        moves.push([newRow, newCol]);
      }
    }
    
    console.log('Final valid moves:', moves);
    return moves;
  }, [gameState.board, getAllJumpSequences]);

  // Count pieces for each player
  const countPieces = useCallback((board: (GamePiece | null)[][]): { red: number; black: number } => {
    let redCount = 0;
    let blackCount = 0;
    
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece?.type === 'red') redCount++;
        if (piece?.type === 'black') blackCount++;
      }
    }
    
    return { red: redCount, black: blackCount };
  }, []);

  // Determine winner by piece count when time runs out
  const determineWinnerByPieceCount = useCallback((board: (GamePiece | null)[][]): Player | null => {
    const { red, black } = countPieces(board);
    
    console.log(`⏰ TIME UP! Piece count - Red: ${red}, Black: ${black}`);
    
    if (red > black) return 'red';
    if (black > red) return 'black';
    return null; // Draw - same number of pieces
  }, [countPieces]);

  // Check for winner
  const checkWinner = useCallback((board: (GamePiece | null)[][]): Player | null => {
    let redPieces = 0;
    let blackPieces = 0;
    
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece?.type === 'red') redPieces++;
        if (piece?.type === 'black') blackPieces++;
      }
    }
    
    // Normal win conditions - all opponent pieces captured
    if (redPieces === 0) return 'black';
    if (blackPieces === 0) return 'red';
    return null;
  }, []);

  // Complete the game and record stats
  const completeGame = useCallback(async (winner: Player) => {
    if (!publicKey) return;

    try {
      // Get player information to determine winner ID
      const gameResponse = await fetch(`/api/games/${gameId}`);
      if (gameResponse.ok) {
        const gameData = await gameResponse.json();
        
        if (gameData.players && gameData.players.length >= 2) {
          const redPlayer = gameData.players[0];
          const blackPlayer = gameData.players[1];
          const winnerId = winner === 'red' ? redPlayer.id : blackPlayer.id;
          
          console.log(`🏆 Completing game with winner: ${winner} (ID: ${winnerId})`);
          
          // First, release escrow funds to winner
          try {
            const escrowResponse = await fetch(`/api/games/${gameId}/escrow`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'release_escrow',
                winnerId,
                playerWallet: publicKey.toString()
              })
            });
            
            if (escrowResponse.ok) {
              const escrowResult = await escrowResponse.json();
              console.log('💰 Escrow released:', escrowResult);
            } else {
              console.error('Failed to release escrow funds');
            }
          } catch (escrowError) {
            console.error('Error releasing escrow:', escrowError);
          }
          
          // Then complete the game and record stats
          const response = await fetch(`/api/games/${gameId}/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              winnerId,
              gameType: 'checkers'
            })
          });
          
          if (response.ok) {
            const result = await response.json();
            console.log('Game completed successfully:', result);
          } else {
            console.error('Failed to complete game:', response.statusText);
          }
        }
      }
    } catch (error) {
      console.error('Error completing game:', error);
    }
  }, [gameId, publicKey]);

  // Handle game timeout
  const handleGameTimeout = useCallback(async () => {
    if (gameState.gameStatus !== 'active') return;
    
    console.log('⏰ GAME TIMEOUT! Determining winner by piece count...');
    
    const winner = determineWinnerByPieceCount(gameState.board);
    const { red, black } = countPieces(gameState.board);
    
    const newState: GameState = {
      ...gameState,
      gameStatus: 'finished',
      winner
    };
    
    setGameState(newState);
    
    // Save the final state
    await saveGameState(newState);
    
    if (winner) {
      console.log(`🏆 ${winner.toUpperCase()} wins by piece count! (${winner === 'red' ? red : black} vs ${winner === 'red' ? black : red})`);
      setGameEndDialog(true);
      await completeGame(winner);
    } else {
      console.log(`🤝 It&apos;s a draw! Well played by both players!`);
      setGameEndDialog(true);
      // Handle draw case - could split pot or return entry fees
    }
  }, [gameState, determineWinnerByPieceCount, countPieces, saveGameState, completeGame]);

  // Make a move - now with MagicBlock real-time integration and MULTIPLE JUMPS!
  const makeMove = useCallback(async (fromRow: number, fromCol: number, toRow: number, toCol: number) => {
    setLoading(true);
    const moveStartTime = Date.now();
    
    const newBoard = gameState.board.map(row => [...row]);
    const piece = newBoard[fromRow][fromCol];
    
    if (!piece || !publicKey) {
      setLoading(false);
      return;
    }
    
    const capturedPieces: [number, number][] = [];
    let finalRow = toRow;
    let finalCol = toCol;
    let currentPiece = piece;
    
    // Check if this is a jump move
    if (Math.abs(toRow - fromRow) === 2) {
      // This is a jump - find the longest jump sequence starting with this move
      const jumpSequences = getAllJumpSequences(fromRow, fromCol, piece);
      
      // Find the sequence that starts with our intended move
      const matchingSequence = jumpSequences.find(sequence => 
        sequence.length > 0 && sequence[0][0] === toRow && sequence[0][1] === toCol
      );
      
      if (matchingSequence && matchingSequence.length > 0) {
        console.log(`🚀 Executing ${matchingSequence.length}-jump sequence:`, matchingSequence);
        
        // Execute the full jump sequence
        let currentRow = fromRow;
        let currentCol = fromCol;
        
        for (const [jumpRow, jumpCol] of matchingSequence) {
          // Calculate the piece being jumped over
          const jumpedRow = Math.floor((currentRow + jumpRow) / 2);
          const jumpedCol = Math.floor((currentCol + jumpCol) / 2);
          
          // Remove the jumped piece
          newBoard[jumpedRow][jumpedCol] = null;
          capturedPieces.push([jumpedRow, jumpedCol]);
          
          // Move the piece to the new position
          newBoard[jumpRow][jumpCol] = currentPiece;
          newBoard[currentRow][currentCol] = null;
          
          // Check for king promotion at each step
          if (currentPiece.type && ((currentPiece.type === 'red' && jumpRow === 0) || (currentPiece.type === 'black' && jumpRow === 7))) {
            currentPiece = { ...currentPiece, isKing: true };
            newBoard[jumpRow][jumpCol] = currentPiece;
            console.log(`🎉 ${currentPiece.type === 'red' ? 'RED' : 'BLACK'} PIECE PROMOTED TO KING at (${jumpRow}, ${jumpCol}) during jump sequence! 👑`);
          }
          
          // Update position for next iteration
          currentRow = jumpRow;
          currentCol = jumpCol;
          finalRow = jumpRow;
          finalCol = jumpCol;
          
          console.log(`Jump ${capturedPieces.length}: (${currentRow}, ${currentCol}) captured piece at (${jumpedRow}, ${jumpedCol})`);
        }
        
        console.log(`🎯 Multiple jump completed! Captured ${capturedPieces.length} pieces: ${capturedPieces.map(([r, c]) => `(${r},${c})`).join(', ')}`);
      } else {
        // Fallback to single jump if sequence not found
        const jumpedRow = Math.floor((fromRow + toRow) / 2);
        const jumpedCol = Math.floor((fromCol + toCol) / 2);
        
        newBoard[toRow][toCol] = currentPiece;
        newBoard[fromRow][fromCol] = null;
        newBoard[jumpedRow][jumpedCol] = null;
        capturedPieces.push([jumpedRow, jumpedCol]);
        
        // Check for king promotion
        if (currentPiece.type && ((currentPiece.type === 'red' && toRow === 0) || (currentPiece.type === 'black' && toRow === 7))) {
          currentPiece = { ...currentPiece, isKing: true };
          newBoard[toRow][toCol] = currentPiece;
          console.log(`🎉 ${currentPiece.type === 'red' ? 'RED' : 'BLACK'} PIECE PROMOTED TO KING at (${toRow}, ${toCol})! 👑`);
        }
      }
    } else {
      // Regular move (not a jump)
      newBoard[toRow][toCol] = currentPiece;
      newBoard[fromRow][fromCol] = null;
      
      // Check for king promotion
      if (currentPiece.type && ((currentPiece.type === 'red' && toRow === 0) || (currentPiece.type === 'black' && toRow === 7))) {
        currentPiece = { ...currentPiece, isKing: true };
        newBoard[toRow][toCol] = currentPiece;
        console.log(`🎉 ${currentPiece.type === 'red' ? 'RED' : 'BLACK'} PIECE PROMOTED TO KING at (${toRow}, ${toCol})! 👑`);
      }
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
        to: [finalRow, finalCol], // Use final position after all jumps
        capturedPieces: capturedPieces.length > 0 ? capturedPieces : undefined
      }
    };
    
    // ⚡ MAGICBLOCK INTEGRATION: Execute real-time move on ephemeral rollup
    if (ephemeralSession) {
      try {
        const moveData: GameMove = {
          gameId,
          playerId: publicKey.toString(),
          moveType: 'piece_move',
          fromPosition: { row: fromRow, col: fromCol },
          toPosition: { row: toRow, col: toCol },
          timestamp: Date.now(),
          ephemeral: true
        };

        console.log('⚡ Executing instant move on MagicBlock...');
        
        // Execute move on 10ms ephemeral rollup for instant feedback
        const moveResult = await magicBlockManager.executeGameMove(
          gameId,
          ephemeralSession,
          moveData,
          publicKey
        );

        if (moveResult.success) {
          const latency = Date.now() - moveStartTime;
          setMoveLatency(latency);
          setRealTimeMoves(prev => prev + 1);
          console.log(`⚡ Move executed instantly in ${latency}ms on ephemeral rollup!`);
        }
      } catch (error) {
        console.error('⚠️ MagicBlock move failed, continuing on mainnet:', error);
        // Game continues normally even if MagicBlock fails
      }
    }
    
    // Update local state instantly for immediate visual feedback
    setGameState(newState);
    
    // Save to mainnet database (SOL betting stays secure here)
    await saveGameState(newState);
    
    if (winner) {
      setGameEndDialog(true);
      // Complete the game and record stats (SOL payouts on mainnet)
      await completeGame(winner);
    }
    
    setLoading(false);
  }, [gameState, saveGameState, checkWinner, completeGame, ephemeralSession, publicKey, gameId, getAllJumpSequences]);

  // Handle square click
  const handleSquareClick = useCallback((row: number, col: number) => {
    console.log('Square clicked:', row, col);
    console.log('Game status:', gameState.gameStatus);
    console.log('Player color:', playerColor);
    console.log('Current player:', gameState.currentPlayer);
    console.log('Loading:', loading);
    
    if (gameState.gameStatus !== 'active') {
      console.log('Game not active');
      return;
    }
    if (!playerColor || gameState.currentPlayer !== playerColor) {
      console.log('Not your turn or no player color assigned');
      return;
    }
    if (loading) {
      console.log('Currently loading');
      return;
    }

    const piece = gameState.board[row][col];
    console.log('Piece at clicked square:', piece);
    
    if (selectedSquare) {
      const [selectedRow, selectedCol] = selectedSquare;
      console.log('Already have selected square:', selectedRow, selectedCol);
      console.log('Valid moves:', validMoves);
      
      // Check if this is a valid move
      const isValidMove = validMoves.some(([r, c]) => r === row && c === col);
      console.log('Is valid move:', isValidMove);
      
      if (isValidMove) {
        console.log('Making move from', selectedRow, selectedCol, 'to', row, col);
        makeMove(selectedRow, selectedCol, row, col);
      } else {
        console.log('Invalid move attempted');
      }
      
      setSelectedSquare(null);
      setValidMoves([]);
    } else if (piece && piece.type === playerColor) {
      console.log('Selecting piece at:', row, col);
      setSelectedSquare([row, col]);
      const moves = getValidMoves(row, col, piece);
      console.log('Calculated valid moves:', moves);
      setValidMoves(moves);
    } else {
      console.log('No valid piece to select');
    }
  }, [gameState.gameStatus, gameState.board, gameState.currentPlayer, playerColor, loading, selectedSquare, validMoves, makeMove, getValidMoves]);

  // Add time management functions
  const formatTime = (milliseconds: number): string => {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Initialize timer when game starts
  useEffect(() => {
    if (gameState.gameStatus === 'active' && gameStartTime) {
      const now = new Date();
      const elapsed = now.getTime() - gameStartTime.getTime();
      const remaining = Math.max(0, GAME_TIME_LIMIT - elapsed);
      setTimeLeft(remaining);
      console.log(`⏰ Timer initialized: ${Math.floor(remaining / 60000)}:${Math.floor((remaining % 60000) / 1000).toString().padStart(2, '0')} remaining`);
    } else if (gameState.gameStatus === 'waiting') {
      setTimeLeft(GAME_TIME_LIMIT); // Reset to full time when waiting
    }
  }, [gameState.gameStatus, gameStartTime]);

  // ADD TIMER COUNTDOWN - Decrements every second and handles timeout
  useEffect(() => {
    let timerInterval: NodeJS.Timeout;
    
    if (gameState.gameStatus === 'active' && gameStartTime) {
      timerInterval = setInterval(() => {
        const now = new Date();
        const elapsed = now.getTime() - gameStartTime.getTime();
        const remaining = Math.max(0, GAME_TIME_LIMIT - elapsed);
        setTimeLeft(remaining);
        
        // Auto-complete game if time runs out
        if (remaining <= 0 && gameState.gameStatus === 'active') {
          console.log('⏰ TIME UP! Auto-completing game...');
          handleGameTimeout();
          clearInterval(timerInterval); // Stop the timer
        }
      }, 1000); // Update every second
    }
    
    return () => {
      if (timerInterval) {
        clearInterval(timerInterval);
      }
    };
  }, [gameState.gameStatus, gameStartTime, handleGameTimeout]);

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
      } else {
        console.error('Escrow status fetch failed:', response.status, response.statusText);
        // Don't set escrow status on error to avoid infinite polling
      }
    } catch (error) {
      console.error('Error fetching escrow status:', error);
      // Don't continue polling if there are persistent errors
    }
  }, [gameId, publicKey]);

  // Add to existing polling effect - but reduce frequency and add error handling
  useEffect(() => {
    if (gameId && publicKey) {
      fetchGameState();
      
      // Only fetch escrow status once on mount, not in polling loop
      fetchEscrowStatus();
      
      // Poll for game state updates every 5 seconds (reduced from 3)
      const interval = setInterval(() => {
        fetchGameState();
        // Don't poll escrow status continuously to avoid 500 errors
      }, 5000);
      
      return () => clearInterval(interval);
    }
  }, [gameId, publicKey, fetchGameState, fetchEscrowStatus]);

  // Initialize game on mount
  useEffect(() => {
    if (gameId && publicKey) {
      initializeGameState();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, publicKey]);

  // Initialize MagicBlock session when game becomes active
  useEffect(() => {
    if (gameState.gameStatus === 'active' && publicKey && signTransaction && !ephemeralSession) {
      initializeMagicBlockSession();
    }
  }, [gameState.gameStatus, publicKey, signTransaction, ephemeralSession, initializeMagicBlockSession]);

  // Render square with classic checkerboard pattern
  const renderSquare = (row: number, col: number) => {
    // Flip the board visually for black player so their pieces appear at bottom
    const displayRow = playerColor === 'black' ? 7 - row : row;
    const displayCol = playerColor === 'black' ? 7 - col : col;
    
    const piece = gameState.board[displayRow][displayCol];
    const isSelected = selectedSquare && selectedSquare[0] === displayRow && selectedSquare[1] === displayCol;
    const isValidMove = validMoves.some(([r, c]) => r === displayRow && c === displayCol);
    const isDarkSquare = (row + col) % 2 === 1; // Keep visual pattern consistent
    const isLastMoveSquare = gameState.lastMove && 
      ((gameState.lastMove.from[0] === displayRow && gameState.lastMove.from[1] === displayCol) ||
       (gameState.lastMove.to[0] === displayRow && gameState.lastMove.to[1] === displayCol));
    
    return (
      <div
        key={`${row}-${col}`}
        className={`square ${isDarkSquare ? 'dark' : 'light'} ${isSelected ? 'selected' : ''} ${isValidMove ? 'valid-move' : ''} ${isLastMoveSquare ? 'last-move' : ''}`}
        onClick={() => handleSquareClick(displayRow, displayCol)}
      >
        {piece && (
          <div className={`piece ${piece.type} ${piece.isKing ? 'king' : ''}`}>
            {piece.isKing ? '👑' : ''}
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
          🏁 Async Multiplayer Checkers 🏁
        </Typography>
        
        {/* Timer and Escrow Info */}
        {gameState.gameStatus === 'active' && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <Paper sx={{ p: 1, mx: 1, bgcolor: timeLeft < 60000 ? '#d32f2f' : '#2e7d32', color: 'white' }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                ⏰ {formatTime(timeLeft)}
              </Typography>
            </Paper>
            {escrowStatus && (
              <Paper sx={{ p: 1, mx: 1, bgcolor: '#ff9800', color: 'white' }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                  💰 Total Pot: {escrowStatus.totalEscrowed.toFixed(4)} SOL
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
        )}
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#FF6B6B' }}>
              🔴 Red Player
            </Typography>
            <Typography variant="body2">
              {gameState.redPlayer ? `${gameState.redPlayer.slice(0, 8)}...` : 'Waiting...'}
            </Typography>
            {gameState.gameStatus === 'active' && (
              <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#FF6B6B' }}>
                Pieces: {countPieces(gameState.board).red}
              </Typography>
            )}
            {escrowStatus && escrowStatus.escrows.find(e => e.wallet_address === gameState.redPlayer && e.status === 'active') && (
              <Typography variant="caption" sx={{ color: '#90EE90' }}>
                ✅ {escrowStatus.escrows.find(e => e.wallet_address === gameState.redPlayer)?.amount} SOL Escrowed
              </Typography>
            )}
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#333' }}>
              ⚫ Black Player
            </Typography>
            <Typography variant="body2">
              {gameState.blackPlayer ? `${gameState.blackPlayer.slice(0, 8)}...` : 'Waiting...'}
            </Typography>
            {gameState.gameStatus === 'active' && (
              <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#333' }}>
                Pieces: {countPieces(gameState.board).black}
              </Typography>
            )}
            {escrowStatus && escrowStatus.escrows.find(e => e.wallet_address === gameState.blackPlayer && e.status === 'active') && (
              <Typography variant="caption" sx={{ color: '#90EE90' }}>
                ✅ {escrowStatus.escrows.find(e => e.wallet_address === gameState.blackPlayer)?.amount} SOL Escrowed
              </Typography>
            )}
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
        
        {escrowStatus && escrowStatus.totalEscrowed > 0 && (
          <Box sx={{ mt: 2, p: 1, bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 1 }}>
            <Typography variant="caption" align="center" display="block">
              💰 Winner gets: {escrowStatus.estimatedWinnerAmount.toFixed(4)} SOL | Platform fee: {(escrowStatus.platformFeePercentage * 100)}%
            </Typography>
          </Box>
        )}
        
        {gameState.gameStatus === 'waiting' && (
          <Box sx={{ textAlign: 'center' }}>
            <Typography gutterBottom sx={{ fontSize: '1.1rem' }}>
              ⏳ Waiting for players to join and escrow funds...
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
            {gameState.winner ? `${gameState.winner.toUpperCase()} WINS!` : 'DRAW!'}
          </Typography>
          
          {/* Show piece count for all games */}
          {gameState.gameStatus === 'finished' && (
            <Box sx={{ textAlign: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Final Piece Count:
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
                <Box>
                  <Typography variant="body1" sx={{ color: '#FF6B6B', fontWeight: 'bold' }}>
                    🔴 Red: {countPieces(gameState.board).red}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body1" sx={{ color: '#333', fontWeight: 'bold' }}>
                    ⚫ Black: {countPieces(gameState.board).black}
                  </Typography>
                </Box>
              </Box>
              
              {/* Show win reason */}
              {gameState.winner && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {countPieces(gameState.board).red === 0 || countPieces(gameState.board).black === 0 
                    ? 'Won by capturing all opponent pieces!'
                    : timeLeft <= 0 
                      ? 'Won by having more pieces when time ran out!'
                      : 'Victory achieved!'}
                </Typography>
              )}
              
              {!gameState.winner && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Both players have the same number of pieces!
                </Typography>
              )}
            </Box>
          )}
          
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
          {gameState.winner !== playerColor && playerColor && gameState.winner && (
            <Typography align="center" sx={{ 
              mt: 2, 
              color: 'error.main', 
              fontSize: '1.1rem'
            }}>
              Better luck next time! 💪
            </Typography>
          )}
          {!gameState.winner && (
            <Typography align="center" sx={{ 
              mt: 2, 
              color: 'warning.main', 
              fontSize: '1.1rem'
            }}>
              🤝 It&apos;s a draw! Well played by both players!
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