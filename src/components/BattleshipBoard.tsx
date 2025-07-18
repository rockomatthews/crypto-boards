'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Paper,
  Typography,
  Button,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  CircularProgress,
} from '@mui/material';
import {
  DirectionsBoat as ShipIcon,
  Whatshot as HitIcon,
  Clear as MissIcon,
  Dangerous as SkullIcon,
} from '@mui/icons-material';

// Ship definitions
const SHIPS = [
  { name: 'Carrier', length: 5, count: 1 },
  { name: 'Battleship', length: 4, count: 1 },
  { name: 'Cruiser', length: 3, count: 1 },
  { name: 'Submarine', length: 3, count: 1 },
  { name: 'Destroyer', length: 2, count: 1 },
];

// Time limits
const SETUP_TIME_LIMIT = 3 * 60 * 1000; // 3 minutes for setup
const TURN_TIME_LIMIT = 30 * 1000; // 30 seconds per turn

type CellStatus = 'empty' | 'ship' | 'hit' | 'miss' | 'sunk';
type GamePhase = 'setup' | 'waiting' | 'playing' | 'completed';
type CellPosition = { row: number; col: number };

interface Ship {
  name: string;
  length: number;
  positions: CellPosition[];
  isHorizontal: boolean;
  isPlaced: boolean;
  isSunk: boolean;
}

interface BattleshipGameState {
  phase: GamePhase;
  currentPlayer: string;
  player1Ships: Ship[];
  player2Ships: Ship[];
  player1Board: CellStatus[][];
  player2Board: CellStatus[][];
  player1Shots: CellStatus[][];
  player2Shots: CellStatus[][];
  winner: string | null;
  lastShot?: CellPosition;
  player1Ready: boolean;
  player2Ready: boolean;
  setupTimeLeft?: number;  // 3 minutes for setup
  turnTimeLeft?: number;   // 30 seconds per turn
  gameStartTime?: number;
}

interface BattleshipBoardProps {
  gameId: string;
}

export default function BattleshipBoard({ gameId }: BattleshipBoardProps) {
  const { publicKey } = useWallet();
  const router = useRouter();
  
  const [gameState, setGameState] = useState<BattleshipGameState>({
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
  });

  // const [gameInfo, setGameInfo] = useState(null);
  const [selectedShip, setSelectedShip] = useState<Ship | null>(null);
  const [shipDirection, setShipDirection] = useState<'horizontal' | 'vertical'>('horizontal');
  const [gameEndDialog, setGameEndDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Timer states
  const [timeLeft, setTimeLeft] = useState<number>(SETUP_TIME_LIMIT);
  const [isMyTurn, setIsMyTurn] = useState(false);
  
  // We need to fetch game info to determine player order
  const [gameInfo, setGameInfo] = useState<{players: {wallet_address: string}[]} | null>(null);
  
  // Determine if current user is player 1 or player 2
  const isCurrentUserPlayer1 = gameInfo?.players?.[0]?.wallet_address === publicKey?.toString();

  // Update board to show sunk ships with skull icons
  // For enemy shots board, we need to check hits against opponent's ships
  const updateSunkShips = (shotsBoard: CellStatus[][], ships: Ship[], targetBoard?: CellStatus[][]) => {
    const newBoard = shotsBoard.map(row => [...row]);
    
    ships.forEach(ship => {
      if (ship.isPlaced && ship.positions.length > 0) {
        // Check if all ship positions are hit on the target board (or shots board for my own ships)
        const allHit = ship.positions.every(pos => {
          const checkBoard = targetBoard || shotsBoard;
          return checkBoard[pos.row][pos.col] === 'hit';
        });
        
        if (allHit) {
          // Mark as sunk on the shots board
          ship.positions.forEach(pos => {
            newBoard[pos.row][pos.col] = 'sunk';
          });
        }
      }
    });
    
    return newBoard;
  };

  // Initialize empty ships for setup
  const initializeShips = useCallback((): Ship[] => {
    return SHIPS.map(shipDef => ({
      name: shipDef.name,
      length: shipDef.length,
      positions: [],
      isHorizontal: true,
      isPlaced: false,
      isSunk: false,
    }));
  }, []);

  // Check if ship placement is valid
  const isValidPlacement = (ship: Ship, startRow: number, startCol: number, isHorizontal: boolean): boolean => {
    // Use the correct board for this player
    const board = isCurrentUserPlayer1 ? gameState.player1Board : gameState.player2Board;
    
    for (let i = 0; i < ship.length; i++) {
      const row = isHorizontal ? startRow : startRow + i;
      const col = isHorizontal ? startCol + i : startCol;
      
      // Check bounds
      if (row >= 10 || col >= 10 || row < 0 || col < 0) return false;
      
      // Check if cell is already occupied
      if (board[row][col] === 'ship') return false;
      
      // Check adjacent cells (ships can't touch)
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const adjRow = row + dr;
          const adjCol = col + dc;
          if (adjRow >= 0 && adjRow < 10 && adjCol >= 0 && adjCol < 10) {
            if (board[adjRow][adjCol] === 'ship') return false;
          }
        }
      }
    }
    
    return true;
  };

  // Place ship on board
  const placeShip = (ship: Ship, startRow: number, startCol: number) => {
    const isHorizontal = shipDirection === 'horizontal';
    const isValid = isValidPlacement(ship, startRow, startCol, isHorizontal);
    console.log('🚢 Place Ship:', { 
      ship: ship.name, 
      startRow, 
      startCol, 
      isHorizontal, 
      isValid 
    });
    
    if (!isValid) return;

    // Use the correct board for this player
    const currentBoard = isCurrentUserPlayer1 ? gameState.player1Board : gameState.player2Board;
    const newBoard = currentBoard.map(row => [...row]);
    const positions: CellPosition[] = [];

    for (let i = 0; i < ship.length; i++) {
      const row = shipDirection === 'horizontal' ? startRow : startRow + i;
      const col = shipDirection === 'horizontal' ? startCol + i : startCol;
      newBoard[row][col] = 'ship';
      positions.push({ row, col });
    }

    const updatedShip = {
      ...ship,
      positions,
      isHorizontal: shipDirection === 'horizontal',
      isPlaced: true,
    };

    // Update the correct player's ships and board
    const currentShips = isCurrentUserPlayer1 ? gameState.player1Ships : gameState.player2Ships;
    const newShips = currentShips.map(s => 
      s.name === ship.name ? updatedShip : s
    );

    if (isCurrentUserPlayer1) {
      setGameState(prev => ({
        ...prev,
        player1Board: newBoard,
        player1Ships: newShips,
      }));
    } else {
      setGameState(prev => ({
        ...prev,
        player2Board: newBoard,
        player2Ships: newShips,
      }));
    }

    setSelectedShip(null);
  };

  // Remove ship from board
  const removeShip = (row: number, col: number) => {
    const currentShips = isCurrentUserPlayer1 ? gameState.player1Ships : gameState.player2Ships;
    const currentBoard = isCurrentUserPlayer1 ? gameState.player1Board : gameState.player2Board;
    
    // Find which ship is at this position
    const shipToRemove = currentShips.find(ship => 
      ship.positions.some(pos => pos.row === row && pos.col === col)
    );
    
    if (!shipToRemove) return;
    
    // Clear the ship from the board
    const newBoard = currentBoard.map(row => [...row]);
    shipToRemove.positions.forEach(pos => {
      newBoard[pos.row][pos.col] = 'empty';
    });
    
    // Reset the ship state
    const newShips = currentShips.map(ship => 
      ship.name === shipToRemove.name 
        ? { ...ship, positions: [], isPlaced: false }
        : ship
    );
    
    // Update state
    if (isCurrentUserPlayer1) {
      setGameState(prev => ({
        ...prev,
        player1Board: newBoard,
        player1Ships: newShips,
      }));
    } else {
      setGameState(prev => ({
        ...prev,
        player2Board: newBoard,
        player2Ships: newShips,
      }));
    }
  };

  // Handle cell click during setup
  const handleSetupCellClick = (row: number, col: number) => {
    console.log('🚢 Setup Click:', { row, col, selectedShip: selectedShip?.name, isPlaced: selectedShip?.isPlaced });
    
    const currentBoard = isCurrentUserPlayer1 ? gameState.player1Board : gameState.player2Board;
    
    // If there's a ship at this position, remove it
    if (currentBoard[row][col] === 'ship') {
      removeShip(row, col);
      return;
    }
    
    // Otherwise, try to place a ship
    if (!selectedShip || selectedShip.isPlaced) return;
    placeShip(selectedShip, row, col);
  };

  // Handle cell click during gameplay
  const handleGameplayCellClick = async (row: number, col: number) => {
    if (gameState.phase !== 'playing') return;
    if (gameState.currentPlayer !== publicKey?.toString()) return;
    if (gameState.player1Shots[row][col] !== 'empty') return; // Already shot here

    try {
      const response = await fetch(`/api/games/${gameId}/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'shoot',
          position: { row, col },
          playerWallet: publicKey?.toString(),
        }),
      });

      if (response.ok) {
        fetchGameState();
      } else {
        setError('Failed to make shot');
      }
    } catch (error) {
      console.error('Error making shot:', error);
      setError('Failed to make shot');
    }
  };

  // Ready up after ship placement
  const handleReady = async () => {
    const currentShips = isCurrentUserPlayer1 ? gameState.player1Ships : gameState.player2Ships;
    const allShipsPlaced = currentShips.every(ship => ship.isPlaced);
    console.log('🚢 Ready Debug:', {
      isCurrentUserPlayer1,
      totalShips: currentShips.length,
      placedShips: currentShips.filter(ship => ship.isPlaced).length,
      allShipsPlaced,
      ships: currentShips.map(ship => ({ name: ship.name, isPlaced: ship.isPlaced }))
    });
    
    if (!allShipsPlaced) {
      setError('Please place all ships before readying up!');
      return;
    }

    console.log('🚢 Sending ready request...', {
      gameId,
      playerWallet: publicKey?.toString(),
      ships: gameState.player1Ships.length
    });

    try {
      const response = await fetch(`/api/games/${gameId}/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ready',
          ships: currentShips,
          playerWallet: publicKey?.toString(),
        }),
      });

      console.log('🚢 Ready response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (response.ok) {
        const data = await response.json();
        console.log('🚢 Ready success:', data);
        fetchGameState();
      } else {
        const errorData = await response.text();
        console.log('🚢 Ready error:', errorData);
        setError(`Failed to ready up: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('🚢 Ready exception:', error);
      setError('Failed to ready up');
    }
  };

  // Handle forfeit
  const handleForfeit = async () => {
    if (!publicKey) return;

    try {
      const response = await fetch(`/api/games/${gameId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId,
          winner: isCurrentUserPlayer1 ? 
            (gameInfo?.players?.[1]?.wallet_address || 'opponent') :
            (gameInfo?.players?.[0]?.wallet_address || 'opponent'),
          reason: 'forfeit',
          playerWallet: publicKey.toString()
        })
      });

      if (response.ok) {
        setGameState(prev => ({
          ...prev,
          phase: 'completed',
          winner: isCurrentUserPlayer1 ? 
            gameInfo?.players?.[1]?.wallet_address || 'opponent' :
            gameInfo?.players?.[0]?.wallet_address || 'opponent'
        }));
      }
    } catch (error) {
      console.error('Error forfeiting game:', error);
      setError('Failed to forfeit game');
    }
  };

  // Auto-place ships randomly
  const autoPlaceShips = () => {
    const newBoard = Array(10).fill(null).map(() => Array(10).fill('empty'));
    const currentShips = isCurrentUserPlayer1 ? gameState.player1Ships : gameState.player2Ships;
    const newShips = [...currentShips];

    for (let shipIndex = 0; shipIndex < SHIPS.length; shipIndex++) {
      const ship = newShips[shipIndex];
      let placed = false;
      let attempts = 0;

      while (!placed && attempts < 100) {
        const isHorizontal = Math.random() > 0.5;
        const maxRow = isHorizontal ? 10 : 10 - ship.length;
        const maxCol = isHorizontal ? 10 - ship.length : 10;
        const startRow = Math.floor(Math.random() * maxRow);
        const startCol = Math.floor(Math.random() * maxCol);

        // Check if placement is valid
        let canPlace = true;
        const positions: CellPosition[] = [];

        for (let i = 0; i < ship.length; i++) {
          const row = isHorizontal ? startRow : startRow + i;
          const col = isHorizontal ? startCol + i : startCol;
          
          if (newBoard[row][col] === 'ship') {
            canPlace = false;
            break;
          }
          positions.push({ row, col });
        }

        if (canPlace) {
          // Place the ship
          positions.forEach(pos => {
            newBoard[pos.row][pos.col] = 'ship';
          });

          newShips[shipIndex] = {
            ...ship,
            positions,
            isHorizontal,
            isPlaced: true,
          };

          placed = true;
        }

        attempts++;
      }
    }

    if (isCurrentUserPlayer1) {
      setGameState(prev => ({
        ...prev,
        player1Board: newBoard,
        player1Ships: newShips,
      }));
    } else {
      setGameState(prev => ({
        ...prev,
        player2Board: newBoard,
        player2Ships: newShips,
      }));
    }
  };

  // Fetch game state
  const fetchGameState = useCallback(async () => {
    console.log('🚢 Fetching game state...');
    try {
      const response = await fetch(`/api/games/${gameId}/state`);
      console.log('🚢 Fetch response:', {
        status: response.status,
        ok: response.ok
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('🚢 Fetched game state:', {
          hasCurrentState: !!data.currentState,
          hasGameState: !!data.gameState,
          phase: data.currentState?.phase || data.gameState?.phase,
          player1Ready: data.currentState?.player1Ready || data.gameState?.player1Ready,
          player2Ready: data.currentState?.player2Ready || data.gameState?.player2Ready,
          hasPlayer1Shots: !!(data.currentState?.player1Shots || data.gameState?.player1Shots),
          hasPlayer2Shots: !!(data.currentState?.player2Shots || data.gameState?.player2Shots),
          hasPlayer1Board: !!(data.currentState?.player1Board || data.gameState?.player1Board),
          hasPlayer2Board: !!(data.currentState?.player2Board || data.gameState?.player2Board)
        });
        
        // The GET endpoint returns 'currentState', POST returns 'gameState'
        const gameState = data.currentState || data.gameState;
        if (gameState) {
          // Ensure shot boards are initialized if missing
          const normalizedState = {
            ...gameState,
            player1Shots: gameState.player1Shots || Array(10).fill(null).map(() => Array(10).fill('empty')),
            player2Shots: gameState.player2Shots || Array(10).fill(null).map(() => Array(10).fill('empty')),
            player1Board: gameState.player1Board || Array(10).fill(null).map(() => Array(10).fill('empty')),
            player2Board: gameState.player2Board || Array(10).fill(null).map(() => Array(10).fill('empty'))
          };
          setGameState(normalizedState);
        }
      } else {
        console.log('🚢 Fetch error:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('🚢 Fetch exception:', error);
    }
  }, [gameId]);

  // Fetch game info
  const fetchGameInfo = useCallback(async () => {
    try {
      const response = await fetch(`/api/games/${gameId}`);
      if (response.ok) {
        const data = await response.json();
        console.log('🚢 Game Info:', data);
        setGameInfo(data);
      }
    } catch (error) {
      console.error('Error fetching game info:', error);
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  // Initialize component
  useEffect(() => {
    if (gameId) {
      fetchGameInfo();
      fetchGameState();
    }
  }, [gameId, fetchGameInfo, fetchGameState]);

  // Initialize ships separately to avoid infinite loop
  useEffect(() => {
    if (gameInfo && isCurrentUserPlayer1 !== undefined) {
      const currentShips = isCurrentUserPlayer1 ? gameState.player1Ships : gameState.player2Ships;
      if (currentShips.length === 0) {
        if (isCurrentUserPlayer1) {
          setGameState(prev => ({
            ...prev,
            player1Ships: initializeShips(),
          }));
        } else {
          setGameState(prev => ({
            ...prev,
            player2Ships: initializeShips(),
          }));
        }
      }
    }
  }, [initializeShips, gameInfo, isCurrentUserPlayer1, gameState.player1Ships.length, gameState.player2Ships.length]);

  // Timer management
  useEffect(() => {
    if (gameState.phase === 'setup') {
      setTimeLeft(SETUP_TIME_LIMIT);
      setIsMyTurn(true);
    } else if (gameState.phase === 'playing') {
      setTimeLeft(TURN_TIME_LIMIT);
      setIsMyTurn(gameState.currentPlayer === publicKey?.toString());
    }
  }, [gameState.phase, gameState.currentPlayer, publicKey]);

  // Timer countdown
  useEffect(() => {
    if ((gameState.phase === 'setup' || (gameState.phase === 'playing' && isMyTurn)) && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          const newTime = prev - 1000;
          if (newTime <= 0) {
            // Time's up - handle timeout
            if (gameState.phase === 'setup') {
              // Auto-place remaining ships and ready up
              autoPlaceShips();
              setTimeout(() => handleReady(), 1000);
            } else if (gameState.phase === 'playing' && isMyTurn) {
              // Skip turn - opponent's turn now
              // The game will automatically switch turns when the API polling detects no action
            }
            return 0;
          }
          return newTime;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [gameState.phase, isMyTurn, timeLeft, autoPlaceShips, handleReady]);

  // Poll for game state updates during gameplay
  useEffect(() => {
    if (gameState.phase === 'playing' || gameState.phase === 'waiting') {
      const interval = setInterval(fetchGameState, 2000);
      return () => clearInterval(interval);
    }
  }, [gameState.phase, fetchGameState]);

  // Handle game completion
  useEffect(() => {
    if (gameState.winner && gameState.phase === 'completed') {
      setGameEndDialog(true);
    }
  }, [gameState.winner, gameState.phase]);

  // Render cell content based on what the player should see
  const renderCell = (
    row: number, 
    col: number, 
    isEnemyBoard: boolean = false,
    cellStatus: CellStatus
  ) => {
    const isMyTurn = gameState.currentPlayer === publicKey?.toString();
    const canClick = gameState.phase === 'setup' ? !isEnemyBoard : isEnemyBoard && isMyTurn;

    let cellContent = null;
    let cellColor = '#f5f5f5';

    if (isEnemyBoard) {
      // Enemy board - only show hits, misses, and sunk ships
      if (cellStatus === 'hit') {
        cellContent = <HitIcon style={{ color: '#d32f2f', fontSize: '20px' }} />;
        cellColor = '#ffcdd2';
      } else if (cellStatus === 'miss') {
        cellContent = <MissIcon style={{ color: '#1976d2', fontSize: '20px' }} />;
        cellColor = '#e3f2fd';
      } else if (cellStatus === 'sunk') {
        cellContent = <SkullIcon style={{ color: '#000000', fontSize: '24px' }} />;
        cellColor = '#757575';
      }
    } else {
      // My board - show ships, hits, misses, and sunk ships
      if (cellStatus === 'ship') {
        cellContent = <ShipIcon style={{ color: '#4caf50', fontSize: '20px' }} />;
        cellColor = '#c8e6c9';
      } else if (cellStatus === 'hit') {
        cellContent = <HitIcon style={{ color: '#d32f2f', fontSize: '20px' }} />;
        cellColor = '#ffcdd2';
      } else if (cellStatus === 'miss') {
        cellContent = <MissIcon style={{ color: '#1976d2', fontSize: '20px' }} />;
        cellColor = '#e3f2fd';
      } else if (cellStatus === 'sunk') {
        cellContent = <SkullIcon style={{ color: '#000000', fontSize: '24px' }} />;
        cellColor = '#757575';
      }
    }

    return (
      <Box
        key={`${row}-${col}`}
        sx={{
          width: 30,
          height: 30,
          border: '1px solid #ccc',
          backgroundColor: cellColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: canClick ? 'pointer' : 'default',
          '&:hover': canClick ? { backgroundColor: '#e0e0e0' } : {},
        }}
        onClick={() => {
          if (gameState.phase === 'setup' && !isEnemyBoard) {
            handleSetupCellClick(row, col);
          } else if (gameState.phase === 'playing' && isEnemyBoard) {
            handleGameplayCellClick(row, col);
          }
        }}
      >
        {cellContent}
      </Box>
    );
  };

  // Render game board
  const renderBoard = (isEnemyBoard: boolean = false) => {
    let board;
    let ships;
    
    console.log('🚢 Rendering board:', {
      isEnemyBoard,
      isCurrentUserPlayer1,
      myWallet: publicKey?.toString(),
      player1Wallet: gameInfo?.players?.[0]?.wallet_address,
      player2Wallet: gameInfo?.players?.[1]?.wallet_address
    });
    
    if (isEnemyBoard) {
      // Enemy board: show shots I've taken
      board = isCurrentUserPlayer1 ? gameState.player1Shots : gameState.player2Shots;
      // For enemy board, we need to check opponent's ships for sunk status
      ships = isCurrentUserPlayer1 ? gameState.player2Ships : gameState.player1Ships;
      // Apply sunk ship detection to enemy shots board using opponent's board as reference
      if (ships.length > 0) {
        const opponentBoard = isCurrentUserPlayer1 ? gameState.player2Board : gameState.player1Board;
        board = updateSunkShips(board, ships.filter(ship => ship.isPlaced), opponentBoard);
      }
    } else {
      // My board: show my ships and enemy shots against me
      board = isCurrentUserPlayer1 ? gameState.player1Board : gameState.player2Board;
      ships = isCurrentUserPlayer1 ? gameState.player1Ships : gameState.player2Ships;
      // Apply sunk ship detection to my board (target board is same as shots board)
      if (ships.length > 0) {
        board = updateSunkShips(board, ships.filter(ship => ship.isPlaced));
      }
    }
    
    // Safety check for board existence
    if (!board || !Array.isArray(board) || board.length !== 10) {
      console.log('🚢 Board not ready:', { isEnemyBoard, boardLength: board?.length });
      return <Box>Loading board...</Box>;
    }
    
    return (
      <Box sx={{ display: 'inline-block', border: '2px solid #333', p: 1 }}>
        {Array.from({ length: 10 }, (_, row) => (
          <Box key={row} sx={{ display: 'flex' }}>
            {Array.from({ length: 10 }, (_, col) => 
              renderCell(row, col, isEnemyBoard, board[row]?.[col] || 'empty')
            )}
          </Box>
        ))}
      </Box>
    );
  };

  // Format time display
  const formatTime = (milliseconds: number) => {
    const totalSeconds = Math.ceil(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Timer display component
  const renderTimer = () => {
    if (gameState.phase === 'setup') {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <CircularProgress 
            variant="determinate" 
            value={(timeLeft / SETUP_TIME_LIMIT) * 100}
            size={40}
            color={timeLeft < 30000 ? "error" : "primary"}
          />
          <Typography variant="h6" color={timeLeft < 30000 ? "error" : "primary"}>
            Setup: {formatTime(timeLeft)}
          </Typography>
        </Box>
      );
    } else if (gameState.phase === 'playing') {
      const isActive = isMyTurn;
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <CircularProgress 
            variant="determinate" 
            value={isActive ? (timeLeft / TURN_TIME_LIMIT) * 100 : 100}
            size={40}
            color={isActive && timeLeft < 10000 ? "error" : "primary"}
          />
          <Typography variant="h6" color={isActive && timeLeft < 10000 ? "error" : "primary"}>
            {isActive ? `Your Turn: ${formatTime(timeLeft)}` : "Opponent's Turn"}
          </Typography>
        </Box>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <LinearProgress sx={{ width: '200px' }} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: '1200px', margin: '0 auto' }}>
      {/* Game Header */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Typography variant="h4" gutterBottom>
            ⚓ Battleship - Game {gameId}
          </Typography>
          
          {(gameState.phase === 'setup' || gameState.phase === 'playing') && (
            <Button 
              variant="outlined" 
              color="error" 
              onClick={handleForfeit}
              size="small"
            >
              Forfeit
            </Button>
          )}
        </Box>
        
        {/* Timer Display */}
        {renderTimer()}
        
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Chip 
            label={`Phase: ${gameState.phase.toUpperCase()}`}
            color={gameState.phase === 'playing' ? 'success' : 'default'}
          />
          
          {gameState.phase === 'playing' && (
            <Chip 
              label={gameState.currentPlayer === publicKey?.toString() ? 'Your Turn' : 'Opponent\'s Turn'}
              color={gameState.currentPlayer === publicKey?.toString() ? 'primary' : 'default'}
            />
          )}
          
          {gameState.winner && (
            <Chip 
              label={gameState.winner === publicKey?.toString() ? 'You Won!' : 'You Lost'}
              color={gameState.winner === publicKey?.toString() ? 'success' : 'error'}
            />
          )}
        </Box>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Setup Phase */}
      {gameState.phase === 'setup' && (
        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          <Box sx={{ flex: 1, minWidth: '300px' }}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                🚢 Ship Placement
              </Typography>
              
              <Box sx={{ mb: 2 }}>
                <Button
                  variant="outlined"
                  onClick={() => setShipDirection(shipDirection === 'horizontal' ? 'vertical' : 'horizontal')}
                  sx={{ mr: 1 }}
                >
                  {shipDirection === 'horizontal' ? '↔️ Horizontal' : '↕️ Vertical'}
                </Button>
                
                <Button variant="outlined" onClick={autoPlaceShips} sx={{ mr: 1 }}>
                  🎲 Auto Place
                </Button>
                
                <Button 
                  variant="contained" 
                  color="primary"
                  onClick={handleReady}
                  disabled={!(isCurrentUserPlayer1 ? gameState.player1Ships : gameState.player2Ships).every(ship => ship.isPlaced)}
                >
                  ✅ Ready!
                </Button>
              </Box>

              {/* Ship Selection */}
              <Box sx={{ mb: 2 }}>
                {(isCurrentUserPlayer1 ? gameState.player1Ships : gameState.player2Ships).map(ship => (
                  <Chip
                    key={ship.name}
                    label={`${ship.name} (${ship.length})`}
                    onClick={() => !ship.isPlaced && setSelectedShip(ship)}
                    color={ship.isPlaced ? 'success' : selectedShip?.name === ship.name ? 'primary' : 'default'}
                    sx={{ mr: 1, mb: 1 }}
                  />
                ))}
              </Box>

              {renderBoard(false)}
            </Paper>
          </Box>

          <Box sx={{ flex: 1, minWidth: '300px' }}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                📋 Instructions
              </Typography>
              <Typography variant="body2" paragraph>
                1. Select a ship from the list above
              </Typography>
              <Typography variant="body2" paragraph>
                2. Choose horizontal or vertical orientation
              </Typography>
              <Typography variant="body2" paragraph>
                3. Click on your board to place the ship
              </Typography>
              <Typography variant="body2" paragraph>
                4. Click placed ships to remove them
              </Typography>
              <Typography variant="body2" paragraph>
                5. Repeat for all ships
              </Typography>
              <Typography variant="body2" paragraph>
                6. Click &quot;Ready!&quot; when all ships are placed
              </Typography>
              
              <Alert severity="info" sx={{ mt: 2 }}>
                Ships cannot touch each other (including diagonally)
              </Alert>
              
              <Alert severity="warning" sx={{ mt: 1 }}>
                ⏰ You have 3 minutes to place all ships!
              </Alert>
            </Paper>
          </Box>
        </Box>
      )}

      {/* Waiting Phase */}
      {gameState.phase === 'waiting' && (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="h6" gutterBottom>
            ⏳ Waiting for opponent to finish setup...
          </Typography>
          <LinearProgress sx={{ mt: 2 }} />
        </Paper>
      )}

      {/* Playing Phase */}
      {gameState.phase === 'playing' && (
        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {/* Boards Section */}
          <Box sx={{ flex: 1, minWidth: '350px' }}>
            {/* Enemy Board - Top */}
            <Paper sx={{ p: 2, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                🎯 Enemy Waters - Click to shoot!
              </Typography>
              {renderBoard(true)}
            </Paper>

            {/* Your Board - Bottom */}
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                🛡️ Your Fleet
              </Typography>
              {renderBoard(false)}
            </Paper>
          </Box>

          {/* Status Section */}
          <Box sx={{ flex: 1, minWidth: '300px' }}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                📊 Game Status
              </Typography>
              
              <Typography variant="body2" paragraph>
                Your Ships Remaining: {gameState.player1Ships.filter(ship => !ship.isSunk).length}/{gameState.player1Ships.length}
              </Typography>
              
              <Typography variant="body2" paragraph>
                Enemy Ships Sunk: {gameState.player2Ships.filter(ship => ship.isSunk).length}/{SHIPS.length}
              </Typography>

              {gameState.currentPlayer === publicKey?.toString() ? (
                <Alert severity="info">
                  Your turn! Click on the enemy board to shoot.
                </Alert>
              ) : (
                <Alert severity="warning">
                  Opponent&apos;s turn. Wait for them to shoot.
                </Alert>
              )}
            </Paper>
          </Box>
        </Box>
      )}

      {/* Game End Dialog */}
      <Dialog open={gameEndDialog} onClose={() => setGameEndDialog(false)}>
        <DialogTitle>
          {gameState.winner === publicKey?.toString() ? '🎉 Victory!' : '💀 Defeat'}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {gameState.winner === publicKey?.toString() 
              ? 'Congratulations! You sunk all enemy ships!' 
              : 'Your fleet has been destroyed. Better luck next time!'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => router.push('/')}>
            Return to Lobby
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}