'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { SOCKET_EVENTS, GameUpdate, LobbyUpdate, GameMove } from './socket';

interface UseSocketOptions {
  gameId?: string;
  lobbyId?: string;
  userId?: string;
  walletAddress?: string;
}

interface UseSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  joinGame: (gameId: string) => void;
  leaveGame: (gameId: string) => void;
  joinLobby: (lobbyId: string) => void;
  leaveLobby: (lobbyId: string) => void;
  sendGameMove: (gameId: string, move: GameMove) => void;
  sendChatMessage: (gameId: string, message: string, sender: string) => void;
  gameUpdates: GameUpdate[];
  lobbyUpdates: LobbyUpdate[];
  clearGameUpdates: () => void;
  clearLobbyUpdates: () => void;
}

export function useSocket(options: UseSocketOptions = {}): UseSocketReturn {
  const { gameId, lobbyId } = options;
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [gameUpdates, setGameUpdates] = useState<GameUpdate[]>([]);
  const [lobbyUpdates, setLobbyUpdates] = useState<LobbyUpdate[]>([]);

  // Initialize socket connection
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Create socket connection
    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001', {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });

    socketRef.current = socket;

    // Connection events
    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      setIsConnected(false);
    });

    // Game events
    socket.on(SOCKET_EVENTS.GAME_UPDATE, (update: GameUpdate) => {
      console.log('Game update received:', update);
      setGameUpdates(prev => [...prev, update]);
    });

    socket.on(SOCKET_EVENTS.GAME_STATE_SYNC, (gameState: Record<string, unknown>) => {
      console.log('Game state sync received:', gameState);
      // Handle game state synchronization
    });

    // Lobby events
    socket.on(SOCKET_EVENTS.LOBBY_UPDATE, (update: LobbyUpdate) => {
      console.log('Lobby update received:', update);
      setLobbyUpdates(prev => [...prev, update]);
    });

    // Chat events
    socket.on(SOCKET_EVENTS.CHAT_MESSAGE, (message: { message: string; sender: string; timestamp: Date }) => {
      console.log('Chat message received:', message);
      // Handle chat messages
    });

    // Error handling
    socket.on('error', (error: Error) => {
      console.error('Socket error:', error);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Auto-join game/lobby when IDs change
  useEffect(() => {
    if (!socketRef.current || !isConnected) return;

    if (gameId) {
      socketRef.current.emit(SOCKET_EVENTS.JOIN_GAME, gameId);
    }

    if (lobbyId) {
      socketRef.current.emit(SOCKET_EVENTS.JOIN_LOBBY, lobbyId);
    }
  }, [gameId, lobbyId, isConnected]);

  // Socket action functions
  const joinGame = useCallback((gameId: string) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit(SOCKET_EVENTS.JOIN_GAME, gameId);
    }
  }, [isConnected]);

  const leaveGame = useCallback((gameId: string) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit(SOCKET_EVENTS.LEAVE_GAME, gameId);
    }
  }, [isConnected]);

  const joinLobby = useCallback((lobbyId: string) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit(SOCKET_EVENTS.JOIN_LOBBY, lobbyId);
    }
  }, [isConnected]);

  const leaveLobby = useCallback((lobbyId: string) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit(SOCKET_EVENTS.LEAVE_LOBBY, lobbyId);
    }
  }, [isConnected]);

  const sendGameMove = useCallback((gameId: string, move: GameMove) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit(SOCKET_EVENTS.GAME_MOVE, { gameId, move });
    }
  }, [isConnected]);

  const sendChatMessage = useCallback((gameId: string, message: string, sender: string) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit(SOCKET_EVENTS.CHAT_MESSAGE, { gameId, message, sender });
    }
  }, [isConnected]);

  const clearGameUpdates = useCallback(() => {
    setGameUpdates([]);
  }, []);

  const clearLobbyUpdates = useCallback(() => {
    setLobbyUpdates([]);
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    joinGame,
    leaveGame,
    joinLobby,
    leaveLobby,
    sendGameMove,
    sendChatMessage,
    gameUpdates,
    lobbyUpdates,
    clearGameUpdates,
    clearLobbyUpdates,
  };
} 