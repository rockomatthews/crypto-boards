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
  Tabs,
  Tab,
} from '@mui/material';
import {
  DirectionsBoat as ShipIcon,
  Whatshot as HitIcon,
  Clear as MissIcon,
} from '@mui/icons-material';

// Ship definitions
const SHIPS = [
  { name: 'Carrier', length: 5, count: 1 },
  { name: 'Battleship', length: 4, count: 1 },
  { name: 'Cruiser', length: 3, count: 1 },
  { name: 'Submarine', length: 3, count: 1 },
  { name: 'Destroyer', length: 2, count: 1 },
];

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
  const [activeTab, setActiveTab] = useState(0); // 0 = My Board, 1 = Enemy Board
  const [gameEndDialog, setGameEndDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
    const board = gameState.player1Board; // Always check against own board during setup
    
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

    const newBoard = gameState.player1Board.map(row => [...row]);
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

    const newShips = gameState.player1Ships.map(s => 
      s.name === ship.name ? updatedShip : s
    );

    setGameState(prev => ({
      ...prev,
      player1Board: newBoard,
      player1Ships: newShips,
    }));

    setSelectedShip(null);
  };

  // Handle cell click during setup
  const handleSetupCellClick = (row: number, col: number) => {
    console.log('🚢 Setup Click:', { row, col, selectedShip: selectedShip?.name, isPlaced: selectedShip?.isPlaced });
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
    const allShipsPlaced = gameState.player1Ships.every(ship => ship.isPlaced);
    console.log('🚢 Ready Debug:', {
      totalShips: gameState.player1Ships.length,
      placedShips: gameState.player1Ships.filter(ship => ship.isPlaced).length,
      allShipsPlaced,
      ships: gameState.player1Ships.map(ship => ({ name: ship.name, isPlaced: ship.isPlaced }))
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
          ships: gameState.player1Ships,
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

  // Auto-place ships randomly
  const autoPlaceShips = () => {
    const newBoard = Array(10).fill(null).map(() => Array(10).fill('empty'));
    const newShips = [...gameState.player1Ships];

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

    setGameState(prev => ({
      ...prev,
      player1Board: newBoard,
      player1Ships: newShips,
    }));
  };

  // Fetch game state
  const fetchGameState = useCallback(async () => {
    try {
      const response = await fetch(`/api/games/${gameId}/state`);
      if (response.ok) {
        const data = await response.json();
        if (data.gameState) {
          setGameState(data.gameState);
        }
      }
    } catch (error) {
      console.error('Error fetching game state:', error);
    }
  }, [gameId]);

  // Fetch game info
  const fetchGameInfo = useCallback(async () => {
    try {
      const response = await fetch(`/api/games/${gameId}`);
      if (response.ok) {
        // const data = await response.json();
        // setGameInfo(data);
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
    if (gameState.player1Ships.length === 0) {
      setGameState(prev => ({
        ...prev,
        player1Ships: initializeShips(),
      }));
    }
  }, [initializeShips]); // Only depend on initializeShips, not gameState

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
      // Enemy board - only show hits and misses
      if (cellStatus === 'hit') {
        cellContent = <HitIcon style={{ color: '#d32f2f', fontSize: '20px' }} />;
        cellColor = '#ffcdd2';
      } else if (cellStatus === 'miss') {
        cellContent = <MissIcon style={{ color: '#1976d2', fontSize: '20px' }} />;
        cellColor = '#e3f2fd';
      } else if (cellStatus === 'sunk') {
        cellContent = <ShipIcon style={{ color: '#000', fontSize: '20px' }} />;
        cellColor = '#424242';
      }
    } else {
      // My board - show ships, hits, and misses
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
        cellContent = <ShipIcon style={{ color: '#000', fontSize: '20px' }} />;
        cellColor = '#424242';
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
    const board = isEnemyBoard ? gameState.player1Shots : gameState.player1Board;
    
    return (
      <Box sx={{ display: 'inline-block', border: '2px solid #333', p: 1 }}>
        {Array.from({ length: 10 }, (_, row) => (
          <Box key={row} sx={{ display: 'flex' }}>
            {Array.from({ length: 10 }, (_, col) => 
              renderCell(row, col, isEnemyBoard, board[row][col])
            )}
          </Box>
        ))}
      </Box>
    );
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
        <Typography variant="h4" gutterBottom>
          ⚓ Battleship - Game {gameId}
        </Typography>
        
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
                  disabled={!gameState.player1Ships.every(ship => ship.isPlaced)}
                >
                  ✅ Ready!
                </Button>
              </Box>

              {/* Ship Selection */}
              <Box sx={{ mb: 2 }}>
                {gameState.player1Ships.map(ship => (
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
                4. Repeat for all ships
              </Typography>
              <Typography variant="body2" paragraph>
                5. Click &quot;Ready!&quot; when all ships are placed
              </Typography>
              
              <Alert severity="info" sx={{ mt: 2 }}>
                Ships cannot touch each other (including diagonally)
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
        <Box>
          <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} sx={{ mb: 2 }}>
            <Tab label="🛡️ My Fleet" />
            <Tab label="🎯 Enemy Waters" />
          </Tabs>

          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            <Box sx={{ flex: 1, minWidth: '300px' }}>
              {activeTab === 0 ? (
                <Paper sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    🛡️ Your Board
                  </Typography>
                  {renderBoard(false)}
                </Paper>
              ) : (
                <Paper sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    🎯 Enemy Board - Click to shoot!
                  </Typography>
                  {renderBoard(true)}
                </Paper>
              )}
            </Box>

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