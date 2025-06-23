import { NextRequest } from 'next/server';
import { Server as SocketIOServer } from 'socket.io';
import { createServer } from 'http';

// Global variable to store the Socket.IO server instance
let io: SocketIOServer;

export async function GET() {
  if (!io) {
    // Initialize Socket.IO server
    const httpServer = createServer();
    io = new SocketIOServer(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    // Socket.IO event handlers
    io.on('connection', (socket) => {
      console.log(`User connected: ${socket.id}`);

      // Handle joining a game room
      socket.on('join-game', (gameId: string) => {
        socket.join(`game:${gameId}`);
        console.log(`User ${socket.id} joined game ${gameId}`);
      });

      // Handle game moves and state updates
      socket.on('game-move', (data: { gameId: string; playerId: string; gameState: any }) => {
        console.log(`Game move from ${data.playerId} in game ${data.gameId}`);
        
        // Broadcast the updated game state to all other players in the room
        socket.to(`game:${data.gameId}`).emit('game-updated', data.gameState);
      });

      // Handle leaving a game room
      socket.on('leave-game', (gameId: string) => {
        socket.leave(`game:${gameId}`);
        console.log(`User ${socket.id} left game ${gameId}`);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
      });
    });

    // Start the server on port 3001 (or environment variable)
    const PORT = process.env.SOCKET_PORT || 3001;
    httpServer.listen(PORT, () => {
      console.log(`Socket.IO server running on port ${PORT}`);
    });
  }

  return new Response(JSON.stringify({ 
    message: 'Socket.IO server initialized',
    status: 'running'
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

// Also handle POST for backwards compatibility
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, gameId, data } = body;

    console.log(`Socket action: ${action} for game: ${gameId}`, data);

    // If Socket.IO server is running, emit events
    if (io) {
      io.to(`game:${gameId}`).emit(action, data);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Socket action processed',
      action,
      gameId
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Socket API error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
} 