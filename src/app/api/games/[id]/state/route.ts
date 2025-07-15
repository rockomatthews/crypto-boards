/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/schema';

// Skip database operations during build
if (!process.env.DATABASE_URL && process.env.NODE_ENV !== 'development') {
  console.log('Skipping database operations during build');
}

// Our actual game state structure from CheckersBoard
interface CheckersGamePiece {
  type: 'red' | 'black' | null;
  isKing: boolean;
}

interface CheckersGameState {
  board: (CheckersGamePiece | null)[][];
  currentPlayer: 'red' | 'black';
  redPlayer: string | null;
  blackPlayer: string | null;
  gameStatus: 'waiting' | 'active' | 'finished';
  winner: 'red' | 'black' | null;
  lastMove?: {
    from: [number, number];
    to: [number, number];
    capturedPieces?: [number, number][];
  };
}

// Stratego game state structure
interface StrategoGamePiece {
  color: 'red' | 'blue' | null;
  rank: string;
  isRevealed: boolean;
  canMove: boolean;
  imagePath?: string;
}

interface StrategoGameState {
  board: (StrategoGamePiece | null)[][];
  currentPlayer: 'red' | 'blue';
  redPlayer: string | null;
  bluePlayer: string | null;
  gameStatus: 'waiting' | 'setup' | 'active' | 'finished';
  winner: 'red' | 'blue' | null;
  setupPhase: boolean;
  setupTimeLeft: number;
  turnTimeLeft: number;
  redPlayerReady: boolean;
  bluePlayerReady: boolean;
  lastMove?: {
    from: [number, number];
    to: [number, number];
    combat?: any;
  };
}

// Battleship game state structure
interface BattleshipShip {
  name: string;
  length: number;
  positions: { row: number; col: number }[];
  isHorizontal: boolean;
  isPlaced: boolean;
  isSunk: boolean;
}

interface BattleshipGameState {
  phase: 'setup' | 'waiting' | 'playing' | 'completed';
  currentPlayer: string;
  player1Ships: BattleshipShip[];
  player2Ships: BattleshipShip[];
  player1Board: string[][];
  player2Board: string[][];
  player1Shots: string[][];
  player2Shots: string[][];
  winner: string | null;
  lastShot?: { row: number; col: number };
  player1Ready: boolean;
  player2Ready: boolean;
}

type GameState = CheckersGameState | StrategoGameState | BattleshipGameState;

export async function GET(
  request: NextRequest,
  context: any
) {
  try {
    // Skip during build
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not available during build' }, { status: 503 });
    }

    const gameId = context?.params?.id;

    if (!gameId) {
      return NextResponse.json({ error: 'Game ID is required' }, { status: 400 });
    }

    // Get current game state
    const stateResult = await db`
      SELECT current_state, last_updated
      FROM game_states
      WHERE game_id = ${gameId}
      ORDER BY last_updated DESC
      LIMIT 1
    `;

    if (stateResult.length === 0) {
      return NextResponse.json({ error: 'Game state not found' }, { status: 404 });
    }

    return NextResponse.json({
      gameId,
      currentState: stateResult[0].current_state,
      lastUpdated: stateResult[0].last_updated
    });
  } catch (error) {
    console.error('Error fetching game state:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  context: any
) {
  try {
    // Skip during build
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not available during build' }, { status: 503 });
    }

    const gameId = context?.params?.id;
    const { newState, playerId } = await request.json();

    console.log(`🎮 State API: Saving game state for ${gameId}`, {
      playerId,
      hasBoard: !!newState?.board,
      gameStatus: newState?.gameStatus,
      setupPhase: newState?.setupPhase,
      boardPieceCount: newState?.board ? newState.board.flat().filter((cell: any) => cell !== null).length : 0
    });

    if (!gameId) {
      return NextResponse.json({ error: 'Game ID is required' }, { status: 400 });
    }

    if (!newState || !playerId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const gameState = newState as GameState;

    // Validate that the game exists
    const gameExists = await db`
      SELECT id, game_type FROM games WHERE id = ${gameId}
    `;

    if (gameExists.length === 0) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    const gameType = gameExists[0].game_type;
    console.log(`🎯 Game type: ${gameType}, State structure:`, {
      hasSetupPhase: 'setupPhase' in gameState,
      hasBluePlayer: 'bluePlayer' in gameState,
      hasBlackPlayer: 'blackPlayer' in gameState
    });

    // Validate that the player is in the game
    const playerInGameResult = await db`
      SELECT game_status FROM game_players 
      WHERE game_id = ${gameId} AND player_id = ${playerId}
    `;

    if (playerInGameResult.length === 0) {
      return NextResponse.json({ error: 'Player not in game' }, { status: 403 });
    }

    // Insert new game state (we'll keep all moves as history)
    const insertResult = await db`
      INSERT INTO game_states (game_id, current_state)
      VALUES (${gameId}, ${JSON.stringify(newState)})
      RETURNING id
    `;

    console.log(`✅ Game state saved successfully with ID: ${insertResult[0].id}`);

    // Check for game end conditions - handle different gameStatus properties
    const isGameFinished = 'gameStatus' in gameState 
      ? gameState.gameStatus === 'finished' 
      : 'phase' in gameState && gameState.phase === 'completed';
      
    if (isGameFinished && gameState.winner) {
      // Update game status to completed
      await db`
        UPDATE games 
        SET status = 'completed', ended_at = CURRENT_TIMESTAMP
        WHERE id = ${gameId}
      `;

      // Try to mark winner in game_players table (if the player exists)
      try {
        await db`
          UPDATE game_players 
          SET is_winner = true
          WHERE game_id = ${gameId} AND player_id = ${playerId}
        `;
      } catch (winnerUpdateError) {
        console.log('Could not update winner status:', winnerUpdateError);
        // This is not critical, continue
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Game state updated successfully',
      gameEnded: isGameFinished,
      winner: gameState.winner,
      stateId: insertResult[0].id,
      gameType: gameType,
      boardPieceCount: 'board' in gameState && gameState.board ? gameState.board.flat().filter(cell => cell !== null).length : 0
    });
  } catch (error) {
    console.error('Error updating game state:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: any
) {
  try {
    // Skip during build
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not available during build' }, { status: 503 });
    }

    const gameId = context?.params?.id;
    const body = await request.json();
    const { action, playerWallet } = body;

    console.log(`🚢 Battleship Action: ${action} for game ${gameId} by ${playerWallet}`);

    if (!gameId || !action || !playerWallet) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get current game state
    const stateResult = await db`
      SELECT current_state, last_updated
      FROM game_states
      WHERE game_id = ${gameId}
      ORDER BY last_updated DESC
      LIMIT 1
    `;

    let currentState: BattleshipGameState;

    if (stateResult.length === 0) {
      // Initialize new Battleship game state
      currentState = {
        phase: 'setup',
        currentPlayer: '',
        player1Ships: [],
        player2Ships: [],
        player1Board: Array(10).fill(null).map(() => Array(10).fill('empty')),
        player2Board: Array(10).fill(null).map(() => Array(10).fill('empty')),
        player1Shots: Array(10).fill(null).map(() => Array(10).fill('empty')),
        player2Shots: Array(10).fill(null).map(() => Array(10).fill('empty')),
        winner: null,
        player1Ready: false,
        player2Ready: false,
      };
    } else {
      currentState = stateResult[0].current_state as BattleshipGameState;
    }

    // Get game players to determine player positions
    const playersResult = await db`
      SELECT 
        p.wallet_address,
        gp.joined_at 
      FROM game_players gp
      JOIN players p ON gp.player_id = p.id
      WHERE gp.game_id = ${gameId} 
      ORDER BY gp.joined_at ASC
    `;

    console.log(`🚢 Battleship Debug: Game ${gameId}`, {
      playerWallet,
      playersInGame: playersResult.map(p => ({ wallet: p.wallet_address, joined: p.joined_at })),
      totalPlayers: playersResult.length
    });

    if (playersResult.length === 0) {
      return NextResponse.json({ error: 'No players found for game' }, { status: 400 });
    }

    const isPlayer1 = playersResult[0].wallet_address === playerWallet;
    const isPlayer2 = playersResult.length > 1 && playersResult[1].wallet_address === playerWallet;

    console.log(`🚢 Player validation:`, {
      playerWallet,
      player1Wallet: playersResult[0].wallet_address,
      player2Wallet: playersResult[1]?.wallet_address,
      isPlayer1,
      isPlayer2
    });

    if (!isPlayer1 && !isPlayer2) {
      return NextResponse.json({ 
        error: 'Player not in this game',
        debug: {
          playerWallet,
          playersInGame: playersResult.map(p => p.wallet_address)
        }
      }, { status: 403 });
    }

    // Handle different actions
    switch (action) {
      case 'ready':
        const { ships } = body;
        if (isPlayer1) {
          currentState.player1Ships = ships;
          currentState.player1Ready = true;
          // Update board with ship positions
          currentState.player1Board = Array(10).fill(null).map(() => Array(10).fill('empty'));
          ships.forEach((ship: BattleshipShip) => {
            ship.positions.forEach(pos => {
              currentState.player1Board[pos.row][pos.col] = 'ship';
            });
          });
        } else {
          currentState.player2Ships = ships;
          currentState.player2Ready = true;
          // Update board with ship positions
          currentState.player2Board = Array(10).fill(null).map(() => Array(10).fill('empty'));
          ships.forEach((ship: BattleshipShip) => {
            ship.positions.forEach(pos => {
              currentState.player2Board[pos.row][pos.col] = 'ship';
            });
          });
        }

        // Check if both players are ready
        if (currentState.player1Ready && currentState.player2Ready) {
          currentState.phase = 'playing';
          currentState.currentPlayer = playersResult[0].wallet_address; // Player 1 goes first
        } else if (currentState.player1Ready || currentState.player2Ready) {
          currentState.phase = 'waiting';
        }
        break;

      case 'shoot':
        const { position } = body;
        console.log(`🚢 Shoot action:`, {
          phase: currentState.phase,
          currentPlayer: currentState.currentPlayer,
          playerWallet,
          position,
          hasPlayer1Board: !!currentState.player1Board,
          hasPlayer2Board: !!currentState.player2Board,
          hasPlayer1Shots: !!currentState.player1Shots,
          hasPlayer2Shots: !!currentState.player2Shots
        });
        
        if (currentState.phase !== 'playing' || currentState.currentPlayer !== playerWallet) {
          return NextResponse.json({ error: 'Not your turn' }, { status: 400 });
        }

        const { row, col } = position;

        // Ensure boards exist before accessing them
        if (!currentState.player1Board || !currentState.player2Board || 
            !currentState.player1Shots || !currentState.player2Shots) {
          console.log('🚢 Missing boards, initializing...');
          currentState.player1Board = currentState.player1Board || Array(10).fill(null).map(() => Array(10).fill('empty'));
          currentState.player2Board = currentState.player2Board || Array(10).fill(null).map(() => Array(10).fill('empty'));
          currentState.player1Shots = currentState.player1Shots || Array(10).fill(null).map(() => Array(10).fill('empty'));
          currentState.player2Shots = currentState.player2Shots || Array(10).fill(null).map(() => Array(10).fill('empty'));
        }

        if (isPlayer1) {
          // Player 1 shooting at Player 2's board
          if (currentState.player2Board[row][col] === 'ship') {
            currentState.player2Board[row][col] = 'hit';
            currentState.player1Shots[row][col] = 'hit';
          } else {
            currentState.player1Shots[row][col] = 'miss';
          }
        } else {
          // Player 2 shooting at Player 1's board
          if (currentState.player1Board[row][col] === 'ship') {
            currentState.player1Board[row][col] = 'hit';
            currentState.player2Shots[row][col] = 'hit';
          } else {
            currentState.player2Shots[row][col] = 'miss';
          }
        }

        currentState.lastShot = { row, col };

        // Check for game end (simplified - just check if any ships remain)
        const player1HasShips = currentState.player1Board.some(row => row.includes('ship'));
        const player2HasShips = currentState.player2Board.some(row => row.includes('ship'));

        if (!player1HasShips) {
          currentState.phase = 'completed';
          currentState.winner = playersResult[1]?.wallet_address || null;
        } else if (!player2HasShips) {
          currentState.phase = 'completed';
          currentState.winner = playersResult[0].wallet_address;
        } else {
          // Switch turns
          currentState.currentPlayer = isPlayer1 ? playersResult[1]?.wallet_address || '' : playersResult[0].wallet_address;
        }
        break;

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    // Save updated state
    await db`
      INSERT INTO game_states (game_id, current_state)
      VALUES (${gameId}, ${JSON.stringify(currentState)})
    `;

    // Update game status if completed
    if (currentState.phase === 'completed') {
      await db`
        UPDATE games 
        SET status = 'completed', ended_at = CURRENT_TIMESTAMP
        WHERE id = ${gameId}
      `;

      if (currentState.winner) {
        await db`
          UPDATE game_players 
          SET is_winner = true
          WHERE game_id = ${gameId} AND player_id = ${currentState.winner}
        `;
      }
    }

    return NextResponse.json({ 
      success: true, 
      gameState: currentState,
      message: `Action ${action} completed successfully`
    });

  } catch (error) {
    console.error('Error handling Battleship action:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 