import { Server as SocketIOServer } from 'socket.io';
import { Server as NetServer } from 'http';
import { NextApiResponse } from 'next';

export interface GameMove {
  from: { row: number; col: number };
  to: { row: number; col: number };
  player: string;
}

export interface GameUpdate {
  gameId: string;
  type: 'move' | 'player_joined' | 'player_left' | 'game_started' | 'game_ended' | 'payment_received';
  data: GameMove | { player: string } | { winner: string } | { amount: number };
  timestamp: Date;
}

export interface LobbyUpdate {
  lobbyId: string;
  type: 'player_joined' | 'player_left' | 'payment_received' | 'ready_to_start';
  data: { player: string } | { amount: number } | { readyCount: number; totalCount: number };
  timestamp: Date;
}

export interface SocketData {
  userId?: string;
  walletAddress?: string;
  currentGame?: string;
  currentLobby?: string;
}

export type NextApiResponseServerIO = NextApiResponse & {
  socket: {
    server: NetServer & {
      io: SocketIOServer;
    };
  };
};

// Socket event types
export const SOCKET_EVENTS = {
  // Game events
  GAME_UPDATE: 'game_update',
  GAME_MOVE: 'game_move',
  GAME_STATE_SYNC: 'game_state_sync',
  
  // Lobby events
  LOBBY_UPDATE: 'lobby_update',
  PLAYER_JOINED: 'player_joined',
  PLAYER_LEFT: 'player_left',
  PAYMENT_RECEIVED: 'payment_received',
  
  // Connection events
  JOIN_GAME: 'join_game',
  LEAVE_GAME: 'leave_game',
  JOIN_LOBBY: 'join_lobby',
  LEAVE_LOBBY: 'leave_lobby',
  
  // Chat events
  CHAT_MESSAGE: 'chat_message',
  
  // System events
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  ERROR: 'error'
} as const;

// Socket room management
export class SocketManager {
  private io: SocketIOServer;

  constructor(io: SocketIOServer) {
    this.io = io;
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`User connected: ${socket.id}`);

      // Handle joining a game room
      socket.on(SOCKET_EVENTS.JOIN_GAME, (gameId: string) => {
        socket.join(`game:${gameId}`);
        socket.data.currentGame = gameId;
        console.log(`User ${socket.id} joined game ${gameId}`);
      });

      // Handle leaving a game room
      socket.on(SOCKET_EVENTS.LEAVE_GAME, (gameId: string) => {
        socket.leave(`game:${gameId}`);
        if (socket.data.currentGame === gameId) {
          socket.data.currentGame = undefined;
        }
        console.log(`User ${socket.id} left game ${gameId}`);
      });

      // Handle joining a lobby room
      socket.on(SOCKET_EVENTS.JOIN_LOBBY, (lobbyId: string) => {
        socket.join(`lobby:${lobbyId}`);
        socket.data.currentLobby = lobbyId;
        console.log(`User ${socket.id} joined lobby ${lobbyId}`);
      });

      // Handle leaving a lobby room
      socket.on(SOCKET_EVENTS.LEAVE_LOBBY, (lobbyId: string) => {
        socket.leave(`lobby:${lobbyId}`);
        if (socket.data.currentLobby === lobbyId) {
          socket.data.currentLobby = undefined;
        }
        console.log(`User ${socket.id} left lobby ${lobbyId}`);
      });

      // Handle game moves
      socket.on(SOCKET_EVENTS.GAME_MOVE, (data: { gameId: string; move: GameMove }) => {
        this.broadcastGameUpdate(data.gameId, {
          gameId: data.gameId,
          type: 'move',
          data: data.move,
          timestamp: new Date()
        });
      });

      // Handle chat messages
      socket.on(SOCKET_EVENTS.CHAT_MESSAGE, (data: { gameId: string; message: string; sender: string }) => {
        this.io.to(`game:${data.gameId}`).emit(SOCKET_EVENTS.CHAT_MESSAGE, {
          message: data.message,
          sender: data.sender,
          timestamp: new Date()
        });
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
      });
    });
  }

  // Broadcast game update to all players in a game
  public broadcastGameUpdate(gameId: string, update: GameUpdate) {
    this.io.to(`game:${gameId}`).emit(SOCKET_EVENTS.GAME_UPDATE, update);
  }

  // Broadcast lobby update to all players in a lobby
  public broadcastLobbyUpdate(lobbyId: string, update: LobbyUpdate) {
    this.io.to(`lobby:${lobbyId}`).emit(SOCKET_EVENTS.LOBBY_UPDATE, update);
  }

  // Send game state sync to a specific user
  public sendGameStateSync(socketId: string, gameState: Record<string, unknown>) {
    this.io.to(socketId).emit(SOCKET_EVENTS.GAME_STATE_SYNC, gameState);
  }

  // Get all connected users in a game
  public getGamePlayers(gameId: string): string[] {
    const room = this.io.sockets.adapter.rooms.get(`game:${gameId}`);
    return room ? Array.from(room) : [];
  }

  // Get all connected users in a lobby
  public getLobbyPlayers(lobbyId: string): string[] {
    const room = this.io.sockets.adapter.rooms.get(`lobby:${lobbyId}`);
    return room ? Array.from(room) : [];
  }
}

// Global socket manager instance
let socketManager: SocketManager | null = null;

export function getSocketManager(io?: SocketIOServer): SocketManager {
  if (!socketManager && io) {
    socketManager = new SocketManager(io);
  }
  if (!socketManager) {
    throw new Error('Socket manager not initialized');
  }
  return socketManager;
} 