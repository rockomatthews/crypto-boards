'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Box, Typography, Paper, Alert, Button, Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress } from '@mui/material';
import GameEndModal from './GameEndModal';
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

// Add turn time limit constant (1 minute)
const TURN_TIME_LIMIT = 60 * 1000; // 1 minute in milliseconds

// Initialize a standard checkers board
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
  const [gameEndWinner, setGameEndWinner] = useState<Player | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [gameCompletionResult, setGameCompletionResult] = useState<{
    escrowReleased: boolean;
    escrowTransactionSignature?: string;
    winnerAmount?: number;
    platformFee?: number;
    message?: string;
  } | null>(null);

  // Forfeit dialog state
  const [showForfeitDialog, setShowForfeitDialog] = useState(false);
  const [forfeitLoading, setForfeitLoading] = useState(false);
  
  // Multi-jump state
  const [multiJumpMode, setMultiJumpMode] = useState(false);
  const [multiJumpPiece, setMultiJumpPiece] = useState<[number, number] | null>(null);
  const [multiJumpTimeout, setMultiJumpTimeout] = useState<NodeJS.Timeout | null>(null);
  
  // Turn timer state
  const [turnTimeLeft, setTurnTimeLeft] = useState<number>(TURN_TIME_LIMIT);
  const [turnStartTime, setTurnStartTime] = useState<Date | null>(null);
  const [lastTurnPlayer, setLastTurnPlayer] = useState<Player | null>(null);
  
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

  // Save game state to API
  const saveGameState = useCallback(async (state: GameState) => {
    if (!publicKey || !currentPlayerId) return;
    
    try {
      const response = await fetch(`/api/games/${gameId}/state`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newState: state,
          playerId: currentPlayerId
        })
      });
      
      if (!response.ok) {
        console.error('Failed to save game state:', response.status);
        setError(`Failed to save game state: ${response.status}`);
      } else {
        if (error) setError(null);
      }
    } catch (error) {
      console.error('Error saving game state:', error);
      setError('Failed to save game state: Network error');
    }
  }, [gameId, publicKey, currentPlayerId, error]);

  // Complete the game
  const completeGame = useCallback(async (winner: Player) => {
    if (!publicKey) return;

    try {
      const gameResponse = await fetch(`/api/games/${gameId}`);
      if (gameResponse.ok) {
        const gameData = await gameResponse.json();
        
        if (gameData.players && gameData.players.length >= 2) {
          // 🔧 FIXED: Properly determine red/black players based on actual game state
          const redPlayerWallet = gameState.redPlayer;
          const blackPlayerWallet = gameState.blackPlayer;
          
          if (!redPlayerWallet || !blackPlayerWallet) {
            console.error('❌ Could not determine red/black players:', { 
              redPlayer: redPlayerWallet, 
              blackPlayer: blackPlayerWallet,
              gameStatePlayers: { red: gameState.redPlayer, black: gameState.blackPlayer }
            });
            setError('Unable to complete game - player assignment unclear');
            return;
          }
          
          const winnerWallet = winner === 'red' ? redPlayerWallet : blackPlayerWallet;
          const loserWallet = winner === 'red' ? blackPlayerWallet : redPlayerWallet;
          
          console.log(`🏁 Completing game: ${winner} wins!`, {
            winner: winner,
            winnerWallet: winnerWallet.slice(0, 8) + '...',
            loserWallet: loserWallet.slice(0, 8) + '...',
            redPlayer: redPlayerWallet.slice(0, 8) + '...',
            blackPlayer: blackPlayerWallet.slice(0, 8) + '...'
          });
          
          const response = await fetch(`/api/games/${gameId}/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              winnerWallet,
              loserWallet
            })
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Failed to complete game:', response.status, errorText);
            setError(`Failed to complete game: ${response.status}`);
          } else {
            const result = await response.json();
            console.log('✅ Game completed successfully:', result);
            
            // Store completion result for GameEndModal
            setGameCompletionResult({
              escrowReleased: result.escrowReleased || false,
              escrowTransactionSignature: result.escrowTransactionSignature,
              winnerAmount: result.winnerAmount,
              platformFee: result.platformFee,
              message: result.message
            });
            
            // Show brief success message
            setError(result.message || '✅ Game completed successfully!');
            setTimeout(() => setError(null), 3000);
          }
        } else {
          console.error('❌ Invalid player data:', gameData.players);
          setError('Unable to complete game - invalid player data');
        }
      } else {
        console.error('❌ Failed to fetch game data:', gameResponse.status);
        setError('Unable to complete game - failed to fetch game data');
      }
    } catch (error) {
      console.error('❌ Error completing game:', error);
      setError('Unable to complete game - network error');
    }
  }, [gameId, publicKey, gameState.redPlayer, gameState.blackPlayer]);

  // Handle forfeit game
  const handleForfeit = useCallback(async () => {
    if (!publicKey || !playerColor || gameState.gameStatus !== 'active') return;
    
    setForfeitLoading(true);
    try {
      const opponent = playerColor === 'red' ? 'black' : 'red';
      
      console.log(`🏳️ Player ${playerColor} is forfeiting! ${opponent} wins!`);
      
      // Update game state to show forfeit
      const forfeitState: GameState = {
        ...gameState,
        gameStatus: 'finished',
        winner: opponent
      };
      
      setGameState(forfeitState);
      await saveGameState(forfeitState);
      
      // Complete the game with opponent as winner
      await completeGame(opponent);
      
      setGameEndDialog(true);
      setShowForfeitDialog(false);
      
    } catch (error) {
      console.error('❌ Error forfeiting game:', error);
      setError('Failed to forfeit game');
    } finally {
      setForfeitLoading(false);
    }
  }, [publicKey, playerColor, gameState, saveGameState, completeGame]);

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
    
    if (redPieces === 0) return 'black';
    if (blackPieces === 0) return 'red';
    return null;
  }, []);

  // Check if a piece can make jumps from a specific position
  const getJumpMoves = useCallback((row: number, col: number, piece: GamePiece, board: (GamePiece | null)[][]): [number, number][] => {
    const jumps: [number, number][] = [];
    if (!piece) return jumps;

    const directions = piece.isKing 
      ? [[-1, -1], [-1, 1], [1, -1], [1, 1]]
      : piece.type === 'red' 
        ? [[-1, -1], [-1, 1]]
        : [[1, -1], [1, 1]];

    for (const [dr, dc] of directions) {
      const jumpedRow = row + dr;
      const jumpedCol = col + dc;
      const landingRow = row + dr * 2;
      const landingCol = col + dc * 2;
      
      if (landingRow >= 0 && landingRow < 8 && landingCol >= 0 && landingCol < 8) {
        const jumpedPiece = board[jumpedRow][jumpedCol];
        const destination = board[landingRow][landingCol];
        
        if (jumpedPiece && jumpedPiece.type !== piece.type && !destination) {
          jumps.push([landingRow, landingCol]);
        }
      }
    }
    
    return jumps;
  }, []);

  // Get valid moves for a piece (simplified for random moves)
  const getValidMoves = useCallback((row: number, col: number, piece: GamePiece): [number, number][] => {
    const moves: [number, number][] = [];
    if (!piece) return moves;

    // In multi-jump mode, only show jump moves for the jumping piece
    if (multiJumpMode && multiJumpPiece) {
      const [jumpRow, jumpCol] = multiJumpPiece;
      if (row === jumpRow && col === jumpCol) {
        return getJumpMoves(row, col, piece, gameState.board);
      }
      return []; // No moves for other pieces during multi-jump
    }

    const directions = piece.isKing 
      ? [[-1, -1], [-1, 1], [1, -1], [1, 1]]
      : piece.type === 'red' 
        ? [[-1, -1], [-1, 1]]
        : [[1, -1], [1, 1]];

    for (const [dr, dc] of directions) {
      const newRow = row + dr;
      const newCol = col + dc;
      
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
  }, [gameState.board, multiJumpMode, multiJumpPiece, getJumpMoves]);

  // Get all possible moves for current player
  const getAllPossibleMoves = useCallback((board: (GamePiece | null)[][], currentPlayer: Player): Array<{ from: [number, number], to: [number, number] }> => {
    const allMoves: Array<{ from: [number, number], to: [number, number] }> = [];
    
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece && piece.type === currentPlayer) {
          const validMoves = getValidMoves(row, col, piece);
          for (const [toRow, toCol] of validMoves) {
            allMoves.push({ from: [row, col], to: [toRow, toCol] });
          }
        }
      }
    }
    
    return allMoves;
  }, [getValidMoves]);

  // Count pieces
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

  // Reset turn timer
  const resetTurnTimer = useCallback(() => {
    setTurnTimeLeft(TURN_TIME_LIMIT);
    setTurnStartTime(new Date());
    console.log(`⏰ Turn timer reset for ${gameState.currentPlayer}`);
  }, [gameState.currentPlayer]);

  // End multi-jump mode and switch players
  const endMultiJump = useCallback(() => {
    if (multiJumpTimeout) {
      clearTimeout(multiJumpTimeout);
      setMultiJumpTimeout(null);
    }
    setMultiJumpMode(false);
    setMultiJumpPiece(null);
    setSelectedSquare(null);
    setValidMoves([]);
  }, [multiJumpTimeout]);

  // Make a move
  const makeMove = useCallback(async (fromRow: number, fromCol: number, toRow: number, toCol: number) => {
    if (gameState.gameStatus !== 'active' || loading) return;

    setLoading(true);
    const moveStartTime = Date.now();
    
    const currentPiece = gameState.board[fromRow][fromCol];
    if (!currentPiece || currentPiece.type !== gameState.currentPlayer) {
      setLoading(false);
      return;
    }
    
    const newBoard = gameState.board.map(row => [...row]);
    const capturedPieces: [number, number][] = [];
    
    // Check if this is a jump move
    const isJump = Math.abs(toRow - fromRow) > 1;
    
    if (isJump) {
      // Handle jump
      const jumpedRow = Math.floor((fromRow + toRow) / 2);
      const jumpedCol = Math.floor((fromCol + toCol) / 2);
      
      newBoard[toRow][toCol] = currentPiece;
      newBoard[fromRow][fromCol] = null;
      newBoard[jumpedRow][jumpedCol] = null;
      capturedPieces.push([jumpedRow, jumpedCol]);
    } else {
      // Regular move
      newBoard[toRow][toCol] = currentPiece;
      newBoard[fromRow][fromCol] = null;
    }
    
    // Check for king promotion
    const finalPiece = { ...currentPiece };
    if (currentPiece.type && ((currentPiece.type === 'red' && toRow === 0) || (currentPiece.type === 'black' && toRow === 7))) {
      finalPiece.isKing = true;
      newBoard[toRow][toCol] = finalPiece;
    }
    
    const winner = checkWinner(newBoard);
    
    // 🚀 MULTI-JUMP LOGIC: Check if we can continue jumping
    let shouldSwitchPlayers = true;
    let nextPlayer: Player = gameState.currentPlayer === 'red' ? 'black' : 'red';
    
    if (isJump && !winner) {
      // Check if the piece that just jumped can make another jump
      const additionalJumps = getJumpMoves(toRow, toCol, finalPiece, newBoard);
      
      if (additionalJumps.length > 0) {
        console.log(`🎯 Multi-jump available! ${gameState.currentPlayer} can continue jumping from (${toRow}, ${toCol})`);
        
        // Don't switch players - continue the turn
        shouldSwitchPlayers = false;
        nextPlayer = gameState.currentPlayer;
        
        // Enter multi-jump mode
        setMultiJumpMode(true);
        setMultiJumpPiece([toRow, toCol]);
        
        // Auto-select the jumping piece and show available jumps
        setTimeout(() => {
          setSelectedSquare([toRow, toCol]);
          setValidMoves(additionalJumps);
        }, 100);
        
        // Set timeout to end multi-jump mode after 2 seconds if no move is made
        const timeout = setTimeout(() => {
          console.log(`⏰ Multi-jump timeout! Ending ${gameState.currentPlayer}'s turn`);
          endMultiJump();
          
                     // Force switch to next player
           const timeoutState: GameState = {
             ...gameState,
             board: newBoard,
             currentPlayer: (gameState.currentPlayer === 'red' ? 'black' : 'red') as Player,
             gameStatus: winner ? 'finished' : 'active',
             winner,
             lastMove: {
               from: [fromRow, fromCol],
               to: [toRow, toCol],
               capturedPieces: capturedPieces.length > 0 ? capturedPieces : undefined
             }
           };
          setGameState(timeoutState);
          saveGameState(timeoutState);
          resetTurnTimer();
        }, 2000); // 2 second timeout
        
        setMultiJumpTimeout(timeout);
      } else {
        // No additional jumps, end multi-jump mode
        endMultiJump();
      }
    } else {
      // Not a jump or game ended, end multi-jump mode
      endMultiJump();
    }
    
    const newState: GameState = {
      ...gameState,
      board: newBoard,
      currentPlayer: shouldSwitchPlayers ? nextPlayer : gameState.currentPlayer,
      gameStatus: winner ? 'finished' : 'active',
      winner,
      lastMove: {
        from: [fromRow, fromCol],
        to: [toRow, toCol],
        capturedPieces: capturedPieces.length > 0 ? capturedPieces : undefined
      }
    };
    
    // MagicBlock integration
    if (ephemeralSession && publicKey) {
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
        }
      } catch (error) {
        console.error('MagicBlock move failed:', error);
      }
    }
    
    setGameState(newState);
    
    // Reset turn timer only if switching players (not during multi-jump)
    if (!winner && shouldSwitchPlayers) {
      setTimeout(() => {
        resetTurnTimer();
      }, 100);
    }
    
    await saveGameState(newState);
    
    if (winner) {
      setGameEndDialog(true);
      setGameEndWinner(winner);
      await completeGame(winner);
    }
    
    setLoading(false);
  }, [gameState, saveGameState, checkWinner, completeGame, ephemeralSession, publicKey, gameId, resetTurnTimer, loading, getJumpMoves, endMultiJump]);

  // Make random move when timer expires
  const makeRandomMove = useCallback(async () => {
    if (gameState.gameStatus !== 'active') return;
    
    console.log(`⏰ Turn timer expired for ${gameState.currentPlayer}! Making random move...`);
    
    const possibleMoves = getAllPossibleMoves(gameState.board, gameState.currentPlayer);
    
    if (possibleMoves.length === 0) {
      // Player has no moves, they lose
      const winner = gameState.currentPlayer === 'red' ? 'black' : 'red';
      const newState: GameState = {
        ...gameState,
        gameStatus: 'finished',
        winner
      };
      setGameState(newState);
      await saveGameState(newState);
      setGameEndDialog(true);
      setGameEndWinner(winner);
      await completeGame(winner);
      return;
    }
    
    // Pick a random move
    const randomMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
    const [fromRow, fromCol] = randomMove.from;
    const [toRow, toCol] = randomMove.to;
    
    console.log(`🎲 Random move: ${gameState.currentPlayer} piece from (${fromRow}, ${fromCol}) to (${toRow}, ${toCol})`);
    
    await makeMove(fromRow, fromCol, toRow, toCol);
  }, [gameState, getAllPossibleMoves, makeMove, saveGameState, completeGame]);

  // Handle turn timeout
  const handleTurnTimeout = useCallback(async () => {
    if (gameState.gameStatus !== 'active') return;
    await makeRandomMove();
  }, [gameState.gameStatus, makeRandomMove]);

  // Initialize game state
  const initializeGameState = useCallback(async () => {
    if (!publicKey) return;
    
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
              setPlayerColor('black');
            }
          }
          
          let gameStatus: 'waiting' | 'active' | 'finished';
          if (gameData.status === 'in_progress') {
            gameStatus = 'active';
          } else if (gameData.status === 'finished') {
            gameStatus = 'finished';
          } else {
            gameStatus = gameData.players.length >= 2 ? 'waiting' : 'waiting';
          }
          
          const newState: GameState = {
            board: createInitialBoard(),
            currentPlayer: 'red' as Player,
            redPlayer: gameData.players[0]?.wallet_address || null,
            blackPlayer: gameData.players[1]?.wallet_address || null,
            gameStatus,
            winner: null,
          };
          
          if (newState.gameStatus === 'active' && !gameStartTime) {
            setGameStartTime(gameData.started_at ? new Date(gameData.started_at) : new Date());
          }
          
          setGameState(newState);
          
          if (gameStatus === 'active') {
            await saveGameState(newState);
          }
        }
      }
    } catch (error) {
      console.error('Error initializing game:', error);
    }
  }, [gameId, publicKey, gameStartTime, saveGameState]);

  // Fetch game state
  const fetchGameState = useCallback(async () => {
    try {
      const response = await fetch(`/api/games/${gameId}/state`);
      if (response.ok) {
        const data = await response.json();
        if (data.currentState) {
          const newState = data.currentState;
          
          // 🚀 Check if game just finished for this player
          const gameJustFinished = gameState.gameStatus !== 'finished' && newState.gameStatus === 'finished' && newState.winner;
          
          setGameState(newState);
          
          // Show game end modal to both players when game finishes
          if (gameJustFinished) {
            console.log(`🏁 Game finished detected via polling! Winner: ${newState.winner}`);
            setGameEndWinner(newState.winner);
            setGameEndDialog(true);
            
            // Try to trigger completion if not already done
            if (newState.winner) {
              try {
                const response = await fetch(`/api/games/${gameId}/complete`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    winnerWallet: newState.winner === 'red' ? newState.redPlayer : newState.blackPlayer,
                    loserWallet: newState.winner === 'red' ? newState.blackPlayer : newState.redPlayer
                  })
                });
                
                if (response.ok) {
                  const result = await response.json();
                  console.log('✅ Game completion via polling:', result);
                  
                  setGameCompletionResult({
                    escrowReleased: result.escrowReleased || false,
                    escrowTransactionSignature: result.escrowTransactionSignature,
                    winnerAmount: result.winnerAmount,
                    platformFee: result.platformFee,
                    message: result.message
                  });
                } else {
                  console.log('⚠️ Game completion via polling failed (likely already completed)');
                }
              } catch (completionError) {
                console.warn('⚠️ Error triggering completion via polling:', completionError);
              }
            }
          }
          
          if (publicKey) {
            const gameResponse = await fetch(`/api/games/${gameId}`);
            if (gameResponse.ok) {
              const gameData = await gameResponse.json();
              const walletAddress = publicKey.toString();
              
              if (gameData.players && gameData.players.length >= 2) {
                if (gameData.players[0].wallet_address === walletAddress) {
                  setPlayerColor('red');
                } else if (gameData.players[1].wallet_address === walletAddress) {
                  setPlayerColor('black');
                }
                
                const currentState = data.currentState;
                if (gameData.status === 'in_progress' && currentState.gameStatus === 'waiting') {
                  const updatedState = {
                    ...currentState,
                    gameStatus: 'active' as const
                  };
                  setGameState(updatedState);
                  await saveGameState(updatedState);
                }
              }
            }
          }
        }
      } else if (response.status === 404) {
        await initializeGameState();
      }
    } catch (error) {
      console.error('Error fetching game state:', error);
      setError('Failed to load game state');
    }
  }, [gameId, publicKey, saveGameState, initializeGameState, gameState.gameStatus]);

  // Handle square click
  const handleSquareClick = useCallback((row: number, col: number) => {
    if (gameState.gameStatus !== 'active') return;
    if (!playerColor || gameState.currentPlayer !== playerColor) return;
    if (loading) return;

    const piece = gameState.board[row][col];
    
    if (selectedSquare) {
      const [selectedRow, selectedCol] = selectedSquare;
      const isValidMove = validMoves.some(([r, c]) => r === row && c === col);
      
      if (isValidMove) {
        makeMove(selectedRow, selectedCol, row, col);
      }
      
      setSelectedSquare(null);
      setValidMoves([]);
    } else if (piece && piece.type === playerColor) {
      setSelectedSquare([row, col]);
      const moves = getValidMoves(row, col, piece);
      setValidMoves(moves);
    }
  }, [gameState.gameStatus, gameState.board, gameState.currentPlayer, playerColor, loading, selectedSquare, validMoves, makeMove, getValidMoves]);

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

  // Format time display
  const formatTime = (milliseconds: number): string => {
    const seconds = Math.floor(milliseconds / 1000);
    return `${seconds}s`;
  };

  // Initialize turn timer when game starts or turn changes
  useEffect(() => {
    if (gameState.gameStatus === 'active') {
      if (lastTurnPlayer !== gameState.currentPlayer) {
        setLastTurnPlayer(gameState.currentPlayer);
        resetTurnTimer();
      }
    } else if (gameState.gameStatus === 'waiting') {
      setTurnTimeLeft(TURN_TIME_LIMIT);
      setTurnStartTime(null);
      setLastTurnPlayer(null);
    }
  }, [gameState.gameStatus, gameState.currentPlayer, lastTurnPlayer, resetTurnTimer]);

  // Turn timer countdown
  useEffect(() => {
    let timerInterval: NodeJS.Timeout;
    
    if (gameState.gameStatus === 'active' && turnStartTime) {
      timerInterval = setInterval(() => {
        const now = new Date();
        const elapsed = now.getTime() - turnStartTime.getTime();
        const remaining = Math.max(0, TURN_TIME_LIMIT - elapsed);
        setTurnTimeLeft(remaining);
        
        if (remaining <= 0 && gameState.gameStatus === 'active') {
          console.log(`⏰ Turn time up for ${gameState.currentPlayer}!`);
          handleTurnTimeout();
          clearInterval(timerInterval);
        }
      }, 1000);
    }
    
    return () => {
      if (timerInterval) {
        clearInterval(timerInterval);
      }
    };
  }, [gameState.gameStatus, gameState.currentPlayer, turnStartTime, handleTurnTimeout]);

  // Game state polling
  useEffect(() => {
    if (gameId && publicKey) {
      fetchGameState();
      fetchEscrowStatus();
      
      // Poll more frequently during active games to catch endings quickly
      const pollInterval = gameState.gameStatus === 'active' ? 2000 : 5000; // 2s during game, 5s otherwise
      
      const interval = setInterval(() => {
        fetchGameState();
      }, pollInterval);
      
      return () => clearInterval(interval);
    }
  }, [gameId, publicKey, fetchGameState, fetchEscrowStatus, gameState.gameStatus]);

  // Initialize game on mount
  useEffect(() => {
    if (gameId && publicKey) {
      initializeGameState();
    }
  }, [gameId, publicKey, initializeGameState]);

  // Initialize MagicBlock session
  useEffect(() => {
    if (gameState.gameStatus === 'active' && publicKey && signTransaction && !ephemeralSession) {
      initializeMagicBlockSession();
    }
  }, [gameState.gameStatus, publicKey, signTransaction, ephemeralSession, initializeMagicBlockSession]);

  // Cleanup multi-jump timeout on unmount
  useEffect(() => {
    return () => {
      if (multiJumpTimeout) {
        clearTimeout(multiJumpTimeout);
      }
    };
  }, [multiJumpTimeout]);

  // Render square
  const renderSquare = (row: number, col: number) => {
    const displayRow = playerColor === 'black' ? 7 - row : row;
    const displayCol = playerColor === 'black' ? 7 - col : col;
    
    const piece = gameState.board[displayRow][displayCol];
    const isSelected = selectedSquare && selectedSquare[0] === displayRow && selectedSquare[1] === displayCol;
    const isValidMove = validMoves.some(([r, c]) => r === displayRow && c === displayCol);
    const isDarkSquare = (row + col) % 2 === 1;
    const isLastMoveSquare = gameState.lastMove && 
      ((gameState.lastMove.from[0] === displayRow && gameState.lastMove.from[1] === displayCol) ||
       (gameState.lastMove.to[0] === displayRow && gameState.lastMove.to[1] === displayCol));
    
    // Check if this is the multi-jump piece
    const isMultiJumpPiece = multiJumpMode && multiJumpPiece && 
      multiJumpPiece[0] === displayRow && multiJumpPiece[1] === displayCol;
    
    return (
      <div
        key={`${row}-${col}`}
        className={`square ${isDarkSquare ? 'dark' : 'light'} ${isSelected ? 'selected' : ''} ${isValidMove ? 'valid-move' : ''} ${isLastMoveSquare ? 'last-move' : ''} ${isMultiJumpPiece ? 'multi-jump' : ''}`}
        onClick={() => handleSquareClick(displayRow, displayCol)}
      >
        {piece && (
          <div className={`piece ${piece.type} ${piece.isKing ? 'king' : ''} ${isMultiJumpPiece ? 'jumping' : ''}`}>
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
          🏁 Checkers with Turn Timer 🏁
        </Typography>
        
        {/* Timer and Info */}
        {gameState.gameStatus === 'active' && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <Paper sx={{ p: 1, mx: 1, bgcolor: turnTimeLeft < 10000 ? '#d32f2f' : '#2e7d32', color: 'white' }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                ⏰ {formatTime(turnTimeLeft)}
              </Typography>
            </Paper>
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
          </Box>
        </Box>
        
        {gameState.gameStatus === 'active' && (
          <Typography align="center" variant="h6" sx={{ 
            bgcolor: multiJumpMode ? '#ff9800' : (gameState.currentPlayer === 'red' ? '#FF6B6B' : '#333'),
            color: 'white',
            p: 1,
            borderRadius: 1,
            fontWeight: 'bold'
          }}>
            {multiJumpMode 
              ? `🚀 ${gameState.currentPlayer.toUpperCase()} - Continue Jumping! (2s)` 
              : gameState.currentPlayer === playerColor 
                ? "🎯 Your Turn!" 
                : `${gameState.currentPlayer.toUpperCase()}'s Turn`
            }
            {loading && " (Making move...)"}
          </Typography>
        )}
        
        {gameState.gameStatus === 'waiting' && (
          <Box sx={{ textAlign: 'center' }}>
            <Typography gutterBottom sx={{ fontSize: '1.1rem' }}>
              ⏳ Waiting for players to join...
            </Typography>
            <Typography variant="body2">
              You are: {playerColor ? playerColor.toUpperCase() : 'Not assigned'}
            </Typography>
          </Box>
        )}

        {gameState.gameStatus === 'active' && (
          <Box sx={{ mt: 2 }}>
            <Box sx={{ p: 1, bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 1, mb: 1 }}>
              <Typography variant="caption" align="center" display="block">
                ⏰ Each turn has 1 minute. No move = random move!
              </Typography>
            </Box>
            {multiJumpMode && (
              <Box sx={{ p: 1, bgcolor: 'rgba(255,152,0,0.2)', borderRadius: 1, mb: 1 }}>
                <Typography variant="caption" align="center" display="block" sx={{ color: 'rgba(255,255,255,0.9)', fontWeight: 'bold' }}>
                  🚀 Multi-jump mode! You have 2 seconds to continue jumping or turn ends
                </Typography>
              </Box>
            )}
            <Box sx={{ p: 1, bgcolor: 'rgba(255,193,7,0.1)', borderRadius: 1 }}>
              <Typography variant="caption" align="center" display="block" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                💡 Small gas fees (~0.0000008 SOL) are normal blockchain transaction costs
              </Typography>
            </Box>
          </Box>
        )}
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Game Controls */}
      {gameState.gameStatus === 'active' && playerColor && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
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
              }
            }}
          >
            🏳️ Forfeit Game
          </Button>
        </Box>
      )}

      {/* Checkerboard */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
        <div className="checkers-board">
          {gameState.board.map((row, rowIndex) =>
            row.map((_, colIndex) => renderSquare(rowIndex, colIndex))
          )}
        </div>
      </Box>

      {/* Game End Modal */}
      <GameEndModal
        open={gameEndDialog}
        onClose={() => {
          setGameEndDialog(false);
          setGameEndWinner(null);
          setGameCompletionResult(null);
        }}
        winner={gameEndWinner ? {
          username: gameEndWinner === 'red' ? 
            (gameState.redPlayer?.slice(0, 8) + '...' || 'Red Player') : 
            (gameState.blackPlayer?.slice(0, 8) + '...' || 'Black Player'),
          walletAddress: gameEndWinner === 'red' ? 
            (gameState.redPlayer || '') : 
            (gameState.blackPlayer || '')
        } : undefined}
        isDraw={!gameEndWinner}
        totalPot={escrowStatus?.totalEscrowed || 0}
        escrowReleased={gameCompletionResult?.escrowReleased || false}
        escrowTransactionSignature={gameCompletionResult?.escrowTransactionSignature}
        winnerAmount={gameCompletionResult?.winnerAmount}
        platformFee={gameCompletionResult?.platformFee}
      />

      {/* Forfeit Confirmation Dialog */}
      <Dialog 
        open={showForfeitDialog} 
        onClose={() => setShowForfeitDialog(false)}
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: { bgcolor: '#2d2d2d', color: 'white' }
        }}
      >
        <DialogTitle sx={{ bgcolor: '#d32f2f', color: 'white', fontWeight: 'bold' }}>
          🏳️ Forfeit Game?
        </DialogTitle>
        <DialogContent sx={{ pt: 3, bgcolor: '#2d2d2d' }}>
          <Typography variant="body1" gutterBottom sx={{ color: 'white' }}>
            Are you sure you want to forfeit this game?
          </Typography>
          <Typography variant="body2" color="warning.main" sx={{ fontWeight: 'bold' }}>
            ⚠️ This will automatically give the win to your opponent and they will receive the full pot!
          </Typography>
          <Typography variant="body2" sx={{ mt: 2, color: '#ccc' }}>
            You will lose your entry fee and this will count as a loss in your stats.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, bgcolor: '#2d2d2d' }}>
          <Button 
            onClick={() => setShowForfeitDialog(false)} 
            sx={{ color: 'white' }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleForfeit}
            disabled={forfeitLoading}
            color="error" 
            variant="contained"
            sx={{ 
              bgcolor: '#d32f2f',
              '&:hover': { bgcolor: '#b71c1c' }
            }}
          >
            {forfeitLoading ? (
              <>
                <CircularProgress size={16} sx={{ mr: 1, color: 'white' }} />
                Forfeiting...
              </>
            ) : (
              '🏳️ Yes, Forfeit'
            )}
          </Button>
        </DialogActions>
      </Dialog>

      <style jsx>{`
        .checkers-board {
          display: grid;
          grid-template-columns: repeat(8, 60px);
          grid-template-rows: repeat(8, 60px);
          gap: 0;
          border: 3px solid #8B4513;
          border-radius: 8px;
          overflow: hidden;
        }
        
        .square {
          width: 60px;
          height: 60px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          position: relative;
          transition: all 0.2s ease;
        }
        
        .square.light {
          background-color: #F5DEB3;
        }
        
        .square.dark {
          background-color: #8B4513;
        }
        
        .square.selected {
          background-color: #FFD700 !important;
          box-shadow: inset 0 0 10px rgba(0,0,0,0.5);
        }
        
        .square.valid-move {
          background-color: #90EE90 !important;
        }
        
        .square.last-move {
          background-color: #87CEEB !important;
        }
        
        .square:hover {
          opacity: 0.8;
        }
        
        .piece {
          width: 45px;
          height: 45px;
          border-radius: 50%;
          border: 3px solid #333;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          font-weight: bold;
          cursor: pointer;
          transition: transform 0.2s ease;
        }
        
        .piece:hover {
          transform: scale(1.1);
        }
        
        .piece.red {
          background: radial-gradient(circle, #FF6B6B, #CC0000);
          color: white;
        }
        
        .piece.black {
          background: radial-gradient(circle, #666, #000);
          color: white;
        }
        
        .piece.king {
          border-color: #FFD700;
          box-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
        }
        
        .square.multi-jump {
          background-color: #ff9800 !important;
          animation: pulse 1s infinite;
        }
        
        .piece.jumping {
          animation: bounce 0.5s infinite alternate;
        }
        
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(255, 152, 0, 0.7); }
          70% { box-shadow: 0 0 0 10px rgba(255, 152, 0, 0); }
          100% { box-shadow: 0 0 0 0 rgba(255, 152, 0, 0); }
        }
        
        @keyframes bounce {
          0% { transform: scale(1.0); }
          100% { transform: scale(1.1); }
        }
      `}</style>
    </Box>
  );
}; 