'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Box, Typography, Paper, Alert, Button, Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress } from '@mui/material';
import GameEndModal from './GameEndModal';
import { PublicKey } from '@solana/web3.js';
import { magicBlockManager, GameMove } from '../lib/magicblock';

// Chess types
type PieceColor = 'white' | 'black' | null;
type Player = 'white' | 'black';

type PieceType = 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn';

interface ChessPiece {
  type: PieceType;
  color: PieceColor;
  hasMoved: boolean; // For castling and pawn double-move tracking
}

interface ChessMove {
  from: [number, number];
  to: [number, number];
  piece: ChessPiece;
  capturedPiece?: ChessPiece;
  isCheck?: boolean;
  isCheckmate?: boolean;
  isStalemate?: boolean;
  isCastle?: 'kingside' | 'queenside';
  isEnPassant?: boolean;
  isPromotion?: boolean;
  promotionPiece?: PieceType;
  notation?: string; // Chess algebraic notation
}

interface GameState {
  board: (ChessPiece | null)[][];
  currentPlayer: Player;
  whitePlayer: string | null;
  blackPlayer: string | null;
  gameStatus: 'waiting' | 'active' | 'finished';
  winner: Player | null;
  lastMove?: ChessMove;
  moveHistory: ChessMove[];
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  isDraw: boolean;
  drawReason?: 'stalemate' | 'insufficient_material' | 'fifty_move' | 'threefold_repetition' | 'agreement';
  fiftyMoveCounter: number;
  enPassantTarget?: [number, number]; // Square where en passant capture is possible
  whiteCanCastleKingside: boolean;
  whiteCanCastleQueenside: boolean;
  blackCanCastleKingside: boolean;
  blackCanCastleQueenside: boolean;
}

interface ChessBoardProps {
  gameId: string;
}

// Time limits
const TURN_TIME_LIMIT = 60 * 1000; // 1 minute per turn

// Initial chess board setup
function createInitialBoard(): (ChessPiece | null)[][] {
  const board: (ChessPiece | null)[][] = Array(8).fill(null).map(() => Array(8).fill(null));
  
  // Place black pieces (top rows)
  const blackBackRow: PieceType[] = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
  for (let col = 0; col < 8; col++) {
    board[0][col] = { type: blackBackRow[col], color: 'black', hasMoved: false };
    board[1][col] = { type: 'pawn', color: 'black', hasMoved: false };
  }
  
  // Place white pieces (bottom rows)
  const whiteBackRow: PieceType[] = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
  for (let col = 0; col < 8; col++) {
    board[7][col] = { type: whiteBackRow[col], color: 'white', hasMoved: false };
    board[6][col] = { type: 'pawn', color: 'white', hasMoved: false };
  }
  
  return board;
}

export const ChessBoard: React.FC<ChessBoardProps> = ({ gameId }) => {
  const { publicKey, signTransaction } = useWallet();
  const [gameState, setGameState] = useState<GameState>(() => ({
    board: createInitialBoard(),
    currentPlayer: 'white',
    whitePlayer: null,
    blackPlayer: null,
    gameStatus: 'waiting',
    winner: null,
    moveHistory: [],
    isCheck: false,
    isCheckmate: false,
    isStalemate: false,
    isDraw: false,
    fiftyMoveCounter: 0,
    whiteCanCastleKingside: true,
    whiteCanCastleQueenside: true,
    blackCanCastleKingside: true,
    blackCanCastleQueenside: true,
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
  
  // Pawn promotion dialog
  const [promotionDialog, setPromotionDialog] = useState<{
    show: boolean;
    move?: ChessMove;
  }>({ show: false });
  
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
  const completeGame = useCallback(async (winner: Player | null, isDraw: boolean = false) => {
    if (!publicKey) return;

    try {
      const gameResponse = await fetch(`/api/games/${gameId}`);
      if (gameResponse.ok) {
        const gameData = await gameResponse.json();
        
        if (gameData.players && gameData.players.length >= 2) {
          const whitePlayerWallet = gameState.whitePlayer;
          const blackPlayerWallet = gameState.blackPlayer;
          
          if (!whitePlayerWallet || !blackPlayerWallet) {
            console.error('❌ Could not determine white/black players:', { 
              whitePlayer: whitePlayerWallet, 
              blackPlayer: blackPlayerWallet,
            });
            setError('Unable to complete game - player assignment unclear');
            return;
          }
          
          let winnerWallet: string | null = null;
          let loserWallet: string | null = null;
          
          if (!isDraw && winner) {
            winnerWallet = winner === 'white' ? whitePlayerWallet : blackPlayerWallet;
            loserWallet = winner === 'white' ? blackPlayerWallet : whitePlayerWallet;
          }
          
          console.log(`🏁 Completing game: ${isDraw ? 'Draw' : winner + ' wins'}!`, {
            winner: winner,
            isDraw,
            winnerWallet: winnerWallet?.slice(0, 8) + '...',
            loserWallet: loserWallet?.slice(0, 8) + '...',
          });
          
          const response = await fetch(`/api/games/${gameId}/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              winnerWallet,
              loserWallet,
              isDraw
            })
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Failed to complete game:', response.status, errorText);
            setError(`Failed to complete game: ${response.status}`);
          } else {
            const result = await response.json();
            console.log('✅ Game completed successfully:', result);
            
            setGameCompletionResult({
              escrowReleased: result.escrowReleased || false,
              escrowTransactionSignature: result.escrowTransactionSignature,
              winnerAmount: result.winnerAmount,
              platformFee: result.platformFee,
              message: result.message
            });
            
            setError(result.message || '✅ Game completed successfully!');
            setTimeout(() => setError(null), 3000);
          }
        }
      }
    } catch (error) {
      console.error('❌ Error completing game:', error);
      setError('Unable to complete game - network error');
    }
  }, [gameId, publicKey, gameState.whitePlayer, gameState.blackPlayer]);

  // Handle forfeit game
  const handleForfeit = useCallback(async () => {
    if (!publicKey || !playerColor || gameState.gameStatus !== 'active') return;
    
    setForfeitLoading(true);
    try {
      const opponent = playerColor === 'white' ? 'black' : 'white';
      
      console.log(`🏳️ Player ${playerColor} is forfeiting! ${opponent} wins!`);
      
      const forfeitState: GameState = {
        ...gameState,
        gameStatus: 'finished',
        winner: opponent
      };
      
      setGameState(forfeitState);
      await saveGameState(forfeitState);
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

  // Check if a square is under attack by the opposing color
  const isSquareUnderAttack = useCallback((row: number, col: number, byColor: PieceColor, board: (ChessPiece | null)[][]): boolean => {
    if (!byColor) return false;
    
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece && piece.color === byColor) {
          const attacks = getPieceAttacks(r, c, piece, board);
          if (attacks.some(([ar, ac]) => ar === row && ac === col)) {
            return true;
          }
        }
      }
    }
    return false;
  }, []);

  // Get squares a piece attacks (different from valid moves for pawns)
  const getPieceAttacks = useCallback((row: number, col: number, piece: ChessPiece, board: (ChessPiece | null)[][]): [number, number][] => {
    const attacks: [number, number][] = [];
    
    switch (piece.type) {
      case 'pawn':
        const direction = piece.color === 'white' ? -1 : 1;
        // Pawns attack diagonally
        const attackSquares = [
          [row + direction, col - 1],
          [row + direction, col + 1]
        ];
        for (const [r, c] of attackSquares) {
          if (r >= 0 && r < 8 && c >= 0 && c < 8) {
            attacks.push([r, c]);
          }
        }
        break;
        
      case 'rook':
        const rookDirections = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (const [dr, dc] of rookDirections) {
          for (let i = 1; i < 8; i++) {
            const newRow = row + dr * i;
            const newCol = col + dc * i;
            if (newRow < 0 || newRow >= 8 || newCol < 0 || newCol >= 8) break;
            
            attacks.push([newRow, newCol]);
            if (board[newRow][newCol]) break; // Stop at first piece
          }
        }
        break;
        
      case 'bishop':
        const bishopDirections = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
        for (const [dr, dc] of bishopDirections) {
          for (let i = 1; i < 8; i++) {
            const newRow = row + dr * i;
            const newCol = col + dc * i;
            if (newRow < 0 || newRow >= 8 || newCol < 0 || newCol >= 8) break;
            
            attacks.push([newRow, newCol]);
            if (board[newRow][newCol]) break;
          }
        }
        break;
        
      case 'queen':
        const queenDirections = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
        for (const [dr, dc] of queenDirections) {
          for (let i = 1; i < 8; i++) {
            const newRow = row + dr * i;
            const newCol = col + dc * i;
            if (newRow < 0 || newRow >= 8 || newCol < 0 || newCol >= 8) break;
            
            attacks.push([newRow, newCol]);
            if (board[newRow][newCol]) break;
          }
        }
        break;
        
      case 'knight':
        const knightMoves = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
        for (const [dr, dc] of knightMoves) {
          const newRow = row + dr;
          const newCol = col + dc;
          if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
            attacks.push([newRow, newCol]);
          }
        }
        break;
        
      case 'king':
        const kingMoves = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
        for (const [dr, dc] of kingMoves) {
          const newRow = row + dr;
          const newCol = col + dc;
          if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
            attacks.push([newRow, newCol]);
          }
        }
        break;
    }
    
    return attacks;
  }, []);

  // Find the king's position
  const findKing = useCallback((color: PieceColor, board: (ChessPiece | null)[][]): [number, number] | null => {
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece && piece.type === 'king' && piece.color === color) {
          return [row, col];
        }
      }
    }
    return null;
  }, []);

  // Check if the current player is in check
  const isInCheck = useCallback((color: PieceColor, board: (ChessPiece | null)[][]): boolean => {
    const kingPos = findKing(color, board);
    if (!kingPos) return false;
    
    const opponentColor = color === 'white' ? 'black' : 'white';
    return isSquareUnderAttack(kingPos[0], kingPos[1], opponentColor, board);
  }, [findKing, isSquareUnderAttack]);

  // Get valid moves for a piece
  const getValidMoves = useCallback((row: number, col: number, piece: ChessPiece): [number, number][] => {
    const moves: [number, number][] = [];
    const board = gameState.board;
    
    switch (piece.type) {
      case 'pawn':
        const direction = piece.color === 'white' ? -1 : 1;
        const startRow = piece.color === 'white' ? 6 : 1;
        
        // Forward moves
        const oneForward = row + direction;
        if (oneForward >= 0 && oneForward < 8 && !board[oneForward][col]) {
          moves.push([oneForward, col]);
          
          // Two squares from starting position
          if (row === startRow) {
            const twoForward = row + direction * 2;
            if (twoForward >= 0 && twoForward < 8 && !board[twoForward][col]) {
              moves.push([twoForward, col]);
            }
          }
        }
        
        // Captures
        const captureSquares = [
          [row + direction, col - 1],
          [row + direction, col + 1]
        ];
        for (const [r, c] of captureSquares) {
          if (r >= 0 && r < 8 && c >= 0 && c < 8) {
            const target = board[r][c];
            if (target && target.color !== piece.color) {
              moves.push([r, c]);
            }
            // En passant
            if (gameState.enPassantTarget && r === gameState.enPassantTarget[0] && c === gameState.enPassantTarget[1]) {
              moves.push([r, c]);
            }
          }
        }
        break;
        
      case 'rook':
        const rookDirections = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (const [dr, dc] of rookDirections) {
          for (let i = 1; i < 8; i++) {
            const newRow = row + dr * i;
            const newCol = col + dc * i;
            if (newRow < 0 || newRow >= 8 || newCol < 0 || newCol >= 8) break;
            
            const target = board[newRow][newCol];
            if (!target) {
              moves.push([newRow, newCol]);
            } else {
              if (target.color !== piece.color) {
                moves.push([newRow, newCol]);
              }
              break;
            }
          }
        }
        break;
        
      case 'bishop':
        const bishopDirections = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
        for (const [dr, dc] of bishopDirections) {
          for (let i = 1; i < 8; i++) {
            const newRow = row + dr * i;
            const newCol = col + dc * i;
            if (newRow < 0 || newRow >= 8 || newCol < 0 || newCol >= 8) break;
            
            const target = board[newRow][newCol];
            if (!target) {
              moves.push([newRow, newCol]);
            } else {
              if (target.color !== piece.color) {
                moves.push([newRow, newCol]);
              }
              break;
            }
          }
        }
        break;
        
      case 'queen':
        const queenDirections = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
        for (const [dr, dc] of queenDirections) {
          for (let i = 1; i < 8; i++) {
            const newRow = row + dr * i;
            const newCol = col + dc * i;
            if (newRow < 0 || newRow >= 8 || newCol < 0 || newCol >= 8) break;
            
            const target = board[newRow][newCol];
            if (!target) {
              moves.push([newRow, newCol]);
            } else {
              if (target.color !== piece.color) {
                moves.push([newRow, newCol]);
              }
              break;
            }
          }
        }
        break;
        
      case 'knight':
        const knightMoves = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
        for (const [dr, dc] of knightMoves) {
          const newRow = row + dr;
          const newCol = col + dc;
          if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
            const target = board[newRow][newCol];
            if (!target || target.color !== piece.color) {
              moves.push([newRow, newCol]);
            }
          }
        }
        break;
        
      case 'king':
        const kingMoves = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
        for (const [dr, dc] of kingMoves) {
          const newRow = row + dr;
          const newCol = col + dc;
          if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
            const target = board[newRow][newCol];
            if (!target || target.color !== piece.color) {
              moves.push([newRow, newCol]);
            }
          }
        }
        
        // Castling
        if (!piece.hasMoved && !isInCheck(piece.color, board)) {
          const backRank = piece.color === 'white' ? 7 : 0;
          
          // Kingside castling
          if ((piece.color === 'white' && gameState.whiteCanCastleKingside) ||
              (piece.color === 'black' && gameState.blackCanCastleKingside)) {
            const rookCol = 7;
            const rook = board[backRank][rookCol];
            if (rook && rook.type === 'rook' && rook.color === piece.color && !rook.hasMoved) {
              // Check if squares between king and rook are empty and not under attack
              const squaresBetween = [5, 6];
              const canCastle = squaresBetween.every(c => 
                !board[backRank][c] && 
                !isSquareUnderAttack(backRank, c, piece.color === 'white' ? 'black' : 'white', board)
              );
              if (canCastle) {
                moves.push([backRank, 6]); // King moves to g-file
              }
            }
          }
          
          // Queenside castling
          if ((piece.color === 'white' && gameState.whiteCanCastleQueenside) ||
              (piece.color === 'black' && gameState.blackCanCastleQueenside)) {
            const rookCol = 0;
            const rook = board[backRank][rookCol];
            if (rook && rook.type === 'rook' && rook.color === piece.color && !rook.hasMoved) {
              // Check if squares between king and rook are empty and not under attack
              const squaresBetween = [1, 2, 3];
              const squaresToCheck = [2, 3]; // King doesn't need to check b-file
              const canCastle = squaresBetween.every(c => !board[backRank][c]) &&
                              squaresToCheck.every(c => 
                                !isSquareUnderAttack(backRank, c, piece.color === 'white' ? 'black' : 'white', board)
                              );
              if (canCastle) {
                moves.push([backRank, 2]); // King moves to c-file
              }
            }
          }
        }
        break;
    }
    
    // Filter moves that would leave the king in check
    return moves.filter(([toRow, toCol]) => {
      const tempBoard = board.map(row => [...row]);
      tempBoard[toRow][toCol] = piece;
      tempBoard[row][col] = null;
      
      return !isInCheck(piece.color, tempBoard);
    });
  }, [gameState.board, gameState.enPassantTarget, gameState.whiteCanCastleKingside, gameState.whiteCanCastleQueenside, gameState.blackCanCastleKingside, gameState.blackCanCastleQueenside, isInCheck, isSquareUnderAttack]);

  // Check for checkmate or stalemate
  const checkGameEndConditions = useCallback((board: (ChessPiece | null)[][], currentPlayer: Player): { 
    isCheckmate: boolean; 
    isStalemate: boolean; 
    isDraw: boolean;
    drawReason?: string;
  } => {
    // Get all legal moves for current player
    const legalMoves: [number, number][] = [];
    
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece && piece.color === currentPlayer) {
          const moves = getValidMoves(row, col, piece);
          legalMoves.push(...moves);
        }
      }
    }
    
    const hasLegalMoves = legalMoves.length > 0;
    const inCheck = isInCheck(currentPlayer, board);
    
    if (!hasLegalMoves) {
      if (inCheck) {
        return { isCheckmate: true, isStalemate: false, isDraw: false };
      } else {
        return { isCheckmate: false, isStalemate: true, isDraw: true, drawReason: 'stalemate' };
      }
    }
    
    // Check for insufficient material
    const pieces = board.flat().filter(p => p !== null) as ChessPiece[];
    if (pieces.length <= 4) {
      const whitePieces = pieces.filter(p => p.color === 'white');
      const blackPieces = pieces.filter(p => p.color === 'black');
      
      // King vs King
      if (pieces.length === 2) {
        return { isCheckmate: false, isStalemate: false, isDraw: true, drawReason: 'insufficient_material' };
      }
      
      // King + Bishop/Knight vs King
      if (pieces.length === 3) {
        const hasOnlyKingAndMinor = (pieces: ChessPiece[]) => 
          pieces.length === 2 && pieces.some(p => p.type === 'bishop' || p.type === 'knight');
        
        if (hasOnlyKingAndMinor(whitePieces) || hasOnlyKingAndMinor(blackPieces)) {
          return { isCheckmate: false, isStalemate: false, isDraw: true, drawReason: 'insufficient_material' };
        }
      }
    }
    
    // Check fifty-move rule
    if (gameState.fiftyMoveCounter >= 100) { // 50 moves = 100 half-moves
      return { isCheckmate: false, isStalemate: false, isDraw: true, drawReason: 'fifty_move' };
    }
    
    return { isCheckmate: false, isStalemate: false, isDraw: false };
  }, [getValidMoves, isInCheck, gameState.fiftyMoveCounter]);

  // Convert move to algebraic notation
  const moveToAlgebraicNotation = useCallback((move: ChessMove): string => {
    const { from, to, piece, capturedPiece, isCastle, isPromotion, promotionPiece } = move;
    
    if (isCastle) {
      return isCastle === 'kingside' ? 'O-O' : 'O-O-O';
    }
    
    let notation = '';
    
    // Piece letter (except for pawns)
    if (piece.type !== 'pawn') {
      notation += piece.type.charAt(0).toUpperCase();
    }
    
    // Disambiguation if needed
    // TODO: Add disambiguation logic for when multiple pieces can move to same square
    
    // Capture notation
    if (capturedPiece || move.isEnPassant) {
      if (piece.type === 'pawn') {
        notation += String.fromCharCode(97 + from[1]); // File letter
      }
      notation += 'x';
    }
    
    // Destination square
    notation += String.fromCharCode(97 + to[1]) + (8 - to[0]);
    
    // Promotion
    if (isPromotion && promotionPiece) {
      notation += '=' + promotionPiece.charAt(0).toUpperCase();
    }
    
    // Check/checkmate
    if (move.isCheckmate) {
      notation += '#';
    } else if (move.isCheck) {
      notation += '+';
    }
    
    return notation;
  }, []);

  // Make a move
  const makeMove = useCallback(async (fromRow: number, fromCol: number, toRow: number, toCol: number, promotionPiece?: PieceType) => {
    if (gameState.gameStatus !== 'active' || loading) return;

    setLoading(true);
    const moveStartTime = Date.now();
    
    const piece = gameState.board[fromRow][fromCol];
    if (!piece || piece.color !== gameState.currentPlayer) {
      setLoading(false);
      return;
    }
    
    const newBoard = gameState.board.map(row => [...row]);
    const capturedPiece = newBoard[toRow][toCol];
    
    // Check for special moves
    let isCastle: 'kingside' | 'queenside' | undefined = undefined;
    let isEnPassant = false;
    let isPromotion = false;
    
    // Handle castling
    if (piece.type === 'king' && Math.abs(toCol - fromCol) === 2) {
      isCastle = toCol > fromCol ? 'kingside' : 'queenside';
      const rookFromCol = toCol > fromCol ? 7 : 0;
      const rookToCol = toCol > fromCol ? 5 : 3;
      const backRank = piece.color === 'white' ? 7 : 0;
      
      // Move rook
      newBoard[backRank][rookToCol] = newBoard[backRank][rookFromCol];
      newBoard[backRank][rookFromCol] = null;
      if (newBoard[backRank][rookToCol]) {
        newBoard[backRank][rookToCol]!.hasMoved = true;
      }
    }
    
    // Handle en passant
    if (piece.type === 'pawn' && gameState.enPassantTarget && 
        toRow === gameState.enPassantTarget[0] && toCol === gameState.enPassantTarget[1]) {
      isEnPassant = true;
      // Remove the captured pawn
      const capturedPawnRow = piece.color === 'white' ? toRow + 1 : toRow - 1;
      newBoard[capturedPawnRow][toCol] = null;
    }
    
    // Handle pawn promotion
    if (piece.type === 'pawn' && (toRow === 0 || toRow === 7)) {
      isPromotion = true;
      if (!promotionPiece) {
        // Show promotion dialog
        const move: ChessMove = {
          from: [fromRow, fromCol],
          to: [toRow, toCol],
          piece,
          capturedPiece: capturedPiece || undefined,
          isPromotion: true
        };
        setPromotionDialog({ show: true, move });
        setLoading(false);
        return;
      }
    }
    
    // Make the move
    const movedPiece = { ...piece, hasMoved: true };
    if (isPromotion && promotionPiece) {
      movedPiece.type = promotionPiece;
    }
    
    newBoard[toRow][toCol] = movedPiece;
    newBoard[fromRow][fromCol] = null;
    
    // Update castling rights
    let newWhiteCanCastleKingside = gameState.whiteCanCastleKingside;
    let newWhiteCanCastleQueenside = gameState.whiteCanCastleQueenside;
    let newBlackCanCastleKingside = gameState.blackCanCastleKingside;
    let newBlackCanCastleQueenside = gameState.blackCanCastleQueenside;
    
    if (piece.type === 'king') {
      if (piece.color === 'white') {
        newWhiteCanCastleKingside = false;
        newWhiteCanCastleQueenside = false;
      } else {
        newBlackCanCastleKingside = false;
        newBlackCanCastleQueenside = false;
      }
    } else if (piece.type === 'rook') {
      if (piece.color === 'white') {
        if (fromCol === 0) newWhiteCanCastleQueenside = false;
        if (fromCol === 7) newWhiteCanCastleKingside = false;
      } else {
        if (fromCol === 0) newBlackCanCastleQueenside = false;
        if (fromCol === 7) newBlackCanCastleKingside = false;
      }
    }
    
    // Update en passant target
    let newEnPassantTarget: [number, number] | undefined = undefined;
    if (piece.type === 'pawn' && Math.abs(toRow - fromRow) === 2) {
      newEnPassantTarget = [fromRow + (toRow - fromRow) / 2, toCol];
    }
    
    // Update fifty-move counter
    let newFiftyMoveCounter = gameState.fiftyMoveCounter + 1;
    if (piece.type === 'pawn' || capturedPiece) {
      newFiftyMoveCounter = 0;
    }
    
    const nextPlayer: Player = gameState.currentPlayer === 'white' ? 'black' : 'white';
    const inCheck = isInCheck(nextPlayer, newBoard);
    const endConditions = checkGameEndConditions(newBoard, nextPlayer);
    
    const move: ChessMove = {
      from: [fromRow, fromCol],
      to: [toRow, toCol],
      piece,
      capturedPiece: capturedPiece || undefined,
      isCheck: inCheck,
      isCheckmate: endConditions.isCheckmate,
      isStalemate: endConditions.isStalemate,
      isCastle,
      isEnPassant,
      isPromotion,
      promotionPiece
    };
    
    move.notation = moveToAlgebraicNotation(move);
    
    const newState: GameState = {
      ...gameState,
      board: newBoard,
      currentPlayer: nextPlayer,
      lastMove: move,
      moveHistory: [...gameState.moveHistory, move],
      isCheck: inCheck,
      isCheckmate: endConditions.isCheckmate,
      isStalemate: endConditions.isStalemate,
      isDraw: endConditions.isDraw,
      drawReason: endConditions.drawReason as 'stalemate' | 'insufficient_material' | 'fifty_move' | 'threefold_repetition' | 'agreement' | undefined,
      gameStatus: endConditions.isCheckmate || endConditions.isDraw ? 'finished' : 'active',
      winner: endConditions.isCheckmate ? gameState.currentPlayer : null,
      fiftyMoveCounter: newFiftyMoveCounter,
      enPassantTarget: newEnPassantTarget,
      whiteCanCastleKingside: newWhiteCanCastleKingside,
      whiteCanCastleQueenside: newWhiteCanCastleQueenside,
      blackCanCastleKingside: newBlackCanCastleKingside,
      blackCanCastleQueenside: newBlackCanCastleQueenside,
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
    await saveGameState(newState);
    
    if (newState.gameStatus === 'finished') {
      setGameEndDialog(true);
      setGameEndWinner(newState.winner);
      if (newState.winner) {
        await completeGame(newState.winner, false);
      } else {
        await completeGame(null, true);
      }
    } else {
      // Reset turn timer for next player
      setTimeout(() => {
        resetTurnTimer();
      }, 100);
    }
    
    setLoading(false);
  }, [gameState, saveGameState, checkGameEndConditions, completeGame, ephemeralSession, publicKey, gameId, isInCheck, moveToAlgebraicNotation, loading]);

  // Handle pawn promotion
  const handlePromotion = useCallback(async (promotionPiece: PieceType) => {
    if (!promotionDialog.move) return;
    
    const { from, to } = promotionDialog.move;
    setPromotionDialog({ show: false });
    
    await makeMove(from[0], from[1], to[0], to[1], promotionPiece);
  }, [promotionDialog.move, makeMove]);

  // Get all possible moves for current player
  const getAllPossibleMoves = useCallback((board: (ChessPiece | null)[][], currentPlayer: Player): Array<{ from: [number, number], to: [number, number] }> => {
    const allMoves: Array<{ from: [number, number], to: [number, number] }> = [];
    
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece && piece.color === currentPlayer) {
          const validMoves = getValidMoves(row, col, piece);
          for (const [toRow, toCol] of validMoves) {
            allMoves.push({ from: [row, col], to: [toRow, toCol] });
          }
        }
      }
    }
    
    return allMoves;
  }, [getValidMoves]);

  // Make random move when timer expires
  const makeRandomMove = useCallback(async () => {
    if (gameState.gameStatus !== 'active') return;
    
    console.log(`⏰ Turn timer expired for ${gameState.currentPlayer}! Making random move...`);
    
    const possibleMoves = getAllPossibleMoves(gameState.board, gameState.currentPlayer);
    
    if (possibleMoves.length === 0) {
      // Player has no moves
      const endConditions = checkGameEndConditions(gameState.board, gameState.currentPlayer);
      const newState: GameState = {
        ...gameState,
        gameStatus: 'finished',
        isCheckmate: endConditions.isCheckmate,
        isStalemate: endConditions.isStalemate,
        isDraw: endConditions.isDraw,
        winner: endConditions.isCheckmate ? (gameState.currentPlayer === 'white' ? 'black' : 'white') : null
      };
      setGameState(newState);
      await saveGameState(newState);
      setGameEndDialog(true);
      setGameEndWinner(newState.winner);
      if (newState.winner) {
        await completeGame(newState.winner, false);
      } else {
        await completeGame(null, true);
      }
      return;
    }
    
    // Pick a random move
    const randomMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
    const [fromRow, fromCol] = randomMove.from;
    const [toRow, toCol] = randomMove.to;
    
    console.log(`🎲 Random move: ${gameState.currentPlayer} piece from (${fromRow}, ${fromCol}) to (${toRow}, ${toCol})`);
    
    // For pawn promotion, randomly choose queen
    const piece = gameState.board[fromRow][fromCol];
    const isPromotion = piece?.type === 'pawn' && (toRow === 0 || toRow === 7);
    
    await makeMove(fromRow, fromCol, toRow, toCol, isPromotion ? 'queen' : undefined);
  }, [gameState, getAllPossibleMoves, makeMove, saveGameState, completeGame, checkGameEndConditions]);

  // Reset turn timer
  const resetTurnTimer = useCallback(() => {
    setTurnTimeLeft(TURN_TIME_LIMIT);
    setTurnStartTime(new Date());
    console.log(`⏰ Turn timer reset for ${gameState.currentPlayer}`);
  }, [gameState.currentPlayer]);

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
    } else if (piece && piece.color === playerColor) {
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
              setPlayerColor('white');
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
            currentPlayer: 'white',
            whitePlayer: gameData.players[0]?.wallet_address || null,
            blackPlayer: gameData.players[1]?.wallet_address || null,
            gameStatus,
            winner: null,
            moveHistory: [],
            isCheck: false,
            isCheckmate: false,
            isStalemate: false,
            isDraw: false,
            fiftyMoveCounter: 0,
            whiteCanCastleKingside: true,
            whiteCanCastleQueenside: true,
            blackCanCastleKingside: true,
            blackCanCastleQueenside: true,
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
          
          const gameJustFinished = gameState.gameStatus !== 'finished' && newState.gameStatus === 'finished' && (newState.winner || newState.isDraw);
          
          setGameState(newState);
          
          if (gameJustFinished) {
            console.log(`🏁 Game finished detected via polling! Winner: ${newState.winner || 'Draw'}`);
            setGameEndWinner(newState.winner);
            setGameEndDialog(true);
            
            if (newState.winner) {
              await completeGame(newState.winner, false);
            } else if (newState.isDraw) {
              await completeGame(null, true);
            }
          }
          
          if (publicKey) {
            const gameResponse = await fetch(`/api/games/${gameId}`);
            if (gameResponse.ok) {
              const gameData = await gameResponse.json();
              const walletAddress = publicKey.toString();
              
              if (gameData.players && gameData.players.length >= 2) {
                if (gameData.players[0].wallet_address === walletAddress) {
                  setPlayerColor('white');
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
  }, [gameId, publicKey, saveGameState, initializeGameState, gameState.gameStatus, completeGame]);

  // Format time display
  const formatTime = (milliseconds: number): string => {
    const seconds = Math.floor(milliseconds / 1000);
    return `${seconds}s`;
  };

  // Get piece symbol
  const getPieceSymbol = (piece: ChessPiece): string => {
    const symbols = {
      white: {
        king: '♔',
        queen: '♕',
        rook: '♖',
        bishop: '♗',
        knight: '♘',
        pawn: '♙'
      },
      black: {
        king: '♚',
        queen: '♛',
        rook: '♜',
        bishop: '♝',
        knight: '♞',
        pawn: '♟'
      }
    };
    return symbols[piece.color!][piece.type];
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
          makeRandomMove();
          clearInterval(timerInterval);
        }
      }, 1000);
    }
    
    return () => {
      if (timerInterval) {
        clearInterval(timerInterval);
      }
    };
  }, [gameState.gameStatus, gameState.currentPlayer, turnStartTime, makeRandomMove]);

  // Game state polling
  useEffect(() => {
    if (gameId && publicKey) {
      fetchGameState();
      fetchEscrowStatus();
      
      const pollInterval = gameState.gameStatus === 'active' ? 2000 : 5000;
      
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

  // Render square
  const renderSquare = (row: number, col: number) => {
    const displayRow = playerColor === 'black' ? 7 - row : row;
    const displayCol = playerColor === 'black' ? 7 - col : col;
    
    const piece = gameState.board[displayRow][displayCol];
    const isSelected = selectedSquare && selectedSquare[0] === displayRow && selectedSquare[1] === displayCol;
    const isValidMove = validMoves.some(([r, c]) => r === displayRow && c === displayCol);
    const isLightSquare = (row + col) % 2 === 0;
    const isLastMoveSquare = gameState.lastMove && 
      ((gameState.lastMove.from[0] === displayRow && gameState.lastMove.from[1] === displayCol) ||
       (gameState.lastMove.to[0] === displayRow && gameState.lastMove.to[1] === displayCol));
    
    // Check square
    const isKingInCheck = piece?.type === 'king' && piece.color === gameState.currentPlayer && gameState.isCheck;
    
    return (
      <div
        key={`${row}-${col}`}
        className={`chess-square ${isLightSquare ? 'light' : 'dark'} ${isSelected ? 'selected' : ''} ${isValidMove ? 'valid-move' : ''} ${isLastMoveSquare ? 'last-move' : ''} ${isKingInCheck ? 'in-check' : ''}`}
        onClick={() => handleSquareClick(displayRow, displayCol)}
      >
        {piece && (
          <div className={`chess-piece ${piece.color}`}>
            {getPieceSymbol(piece)}
          </div>
        )}
        
        {/* Coordinate labels */}
        {col === 0 && (
          <div className="rank-label">
            {playerColor === 'black' ? row + 1 : 8 - row}
          </div>
        )}
        {row === 7 && (
          <div className="file-label">
            {String.fromCharCode(97 + (playerColor === 'black' ? 7 - col : col))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      {/* Game Info */}
      <Paper sx={{ p: 2, mb: 3, bgcolor: '#1e1e1e', color: 'white', borderRadius: 2 }}>
        <Typography variant="h4" align="center" gutterBottom sx={{ fontWeight: 'bold' }}>
          ♔ Chess Masters ♛
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
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#f5f5f5' }}>
              ♔ White Player
            </Typography>
            <Typography variant="body2">
              {gameState.whitePlayer ? `${gameState.whitePlayer.slice(0, 8)}...` : 'Waiting...'}
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#333' }}>
              ♚ Black Player
            </Typography>
            <Typography variant="body2">
              {gameState.blackPlayer ? `${gameState.blackPlayer.slice(0, 8)}...` : 'Waiting...'}
            </Typography>
          </Box>
        </Box>
        
        {gameState.gameStatus === 'active' && (
          <Typography align="center" variant="h6" sx={{ 
            bgcolor: gameState.currentPlayer === 'white' ? '#f5f5f5' : '#333',
            color: gameState.currentPlayer === 'white' ? '#000' : '#fff',
            p: 1,
            borderRadius: 1,
            fontWeight: 'bold'
          }}>
            {gameState.isCheck && `Check! `}
            {gameState.currentPlayer === playerColor 
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

      {/* Chess Board */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
        <div className="chess-board">
          {Array.from({ length: 8 }, (_, row) =>
            Array.from({ length: 8 }, (_, col) => renderSquare(row, col))
          )}
        </div>
      </Box>

      {/* Move History */}
      {gameState.moveHistory.length > 0 && (
        <Paper sx={{ p: 2, mb: 2, bgcolor: '#f5f5f5', maxHeight: 200, overflow: 'auto' }}>
          <Typography variant="h6" gutterBottom>
            📝 Move History
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {gameState.moveHistory.map((move, index) => (
              <Typography 
                key={index} 
                variant="body2" 
                sx={{ 
                  minWidth: '60px',
                  color: index % 2 === 0 ? '#000' : '#666'
                }}
              >
                {Math.floor(index / 2) + 1}{index % 2 === 0 ? '.' : '...'} {move.notation}
              </Typography>
            ))}
          </Box>
        </Paper>
      )}

      {/* Pawn Promotion Dialog */}
      <Dialog open={promotionDialog.show} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ textAlign: 'center' }}>
          👑 Pawn Promotion
        </DialogTitle>
        <DialogContent>
          <Typography align="center" gutterBottom>
            Choose a piece to promote your pawn to:
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 2 }}>
            {['queen', 'rook', 'bishop', 'knight'].map((pieceType) => (
              <Button
                key={pieceType}
                variant="outlined"
                onClick={() => handlePromotion(pieceType as PieceType)}
                sx={{ 
                  minWidth: 80,
                  height: 80,
                  fontSize: '2rem'
                }}
              >
                {getPieceSymbol({ 
                  type: pieceType as PieceType, 
                  color: gameState.currentPlayer, 
                  hasMoved: false 
                })}
              </Button>
            ))}
          </Box>
        </DialogContent>
      </Dialog>

      {/* Game End Modal */}
      <GameEndModal
        open={gameEndDialog}
        onClose={() => {
          setGameEndDialog(false);
          setGameEndWinner(null);
          setGameCompletionResult(null);
        }}
        winner={gameEndWinner ? {
          username: gameEndWinner === 'white' ? 
            (gameState.whitePlayer?.slice(0, 8) + '...' || 'White Player') : 
            (gameState.blackPlayer?.slice(0, 8) + '...' || 'Black Player'),
          walletAddress: gameEndWinner === 'white' ? 
            (gameState.whitePlayer || '') : 
            (gameState.blackPlayer || '')
        } : undefined}
        isDraw={gameState.isDraw}
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
        .chess-board {
          display: grid;
          grid-template-columns: repeat(8, 80px);
          grid-template-rows: repeat(8, 80px);
          gap: 0;
          border: 4px solid #8B4513;
          border-radius: 8px;
          overflow: hidden;
          position: relative;
        }
        
        .chess-square {
          width: 80px;
          height: 80px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          position: relative;
          transition: all 0.2s ease;
        }
        
        .chess-square.light {
          background-color: #F0D9B5;
        }
        
        .chess-square.dark {
          background-color: #B58863;
        }
        
        .chess-square.selected {
          background-color: #FFD700 !important;
          box-shadow: inset 0 0 10px rgba(0,0,0,0.5);
        }
        
        .chess-square.valid-move {
          background-color: #90EE90 !important;
        }
        
        .chess-square.last-move {
          background-color: #87CEEB !important;
        }
        
        .chess-square.in-check {
          background-color: #FF6B6B !important;
          animation: pulse 1s infinite;
        }
        
        .chess-square:hover {
          opacity: 0.8;
        }
        
        .chess-piece {
          width: 70px;
          height: 70px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: transform 0.2s ease;
          user-select: none;
          font-size: 48px;
          text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
          filter: drop-shadow(1px 1px 2px rgba(0, 0, 0, 0.2));
        }
        
        .chess-piece.white {
          color: #FFFFFF;
          text-shadow: 
            2px 2px 0px #000000,
            -1px -1px 0px #000000,  
            1px -1px 0px #000000,
            -1px 1px 0px #000000,
            2px 2px 4px rgba(0, 0, 0, 0.5);
        }
        
        .chess-piece.black {
          color: #1a1a1a;
          text-shadow: 
            1px 1px 0px #FFFFFF,
            -1px -1px 0px #FFFFFF,  
            1px -1px 0px #FFFFFF,
            -1px 1px 0px #FFFFFF,
            2px 2px 4px rgba(255, 255, 255, 0.3);
        }
        
        .chess-piece:hover {
          transform: scale(1.15);
          filter: drop-shadow(2px 2px 6px rgba(0, 0, 0, 0.4));
        }
        
        .rank-label {
          position: absolute;
          top: 2px;
          left: 2px;
          font-size: 12px;
          font-weight: bold;
          color: #666;
          pointer-events: none;
        }
        
        .file-label {
          position: absolute;
          bottom: 2px;
          right: 2px;
          font-size: 12px;
          font-weight: bold;
          color: #666;
          pointer-events: none;
        }
        
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(255, 107, 107, 0.7); }
          70% { box-shadow: 0 0 0 10px rgba(255, 107, 107, 0); }
          100% { box-shadow: 0 0 0 0 rgba(255, 107, 107, 0); }
        }
        
        @media (max-width: 600px) {
          .chess-board {
            grid-template-columns: repeat(8, 60px);
            grid-template-rows: repeat(8, 60px);
          }
          
          .chess-square {
            width: 60px;
            height: 60px;
          }
          
          .chess-piece {
            width: 50px;
            height: 50px;
          }
        }
      `}</style>
    </Box>
  );
}; 