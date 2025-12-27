import React, { useState, useEffect } from 'react';
import { gameClient, GameState } from './services/GameClient';
import { InventoryHUD } from './components/InventoryHUD';
import { KeyboardControls } from "./components/KeyboardControls";
import { GameUI } from "./components/GameUI";

// Simple CSS-based dungeon renderer
const DungeonRenderer: React.FC<{ gameState: any }> = ({ gameState }) => {
  if (!gameState || !gameState.map) return null;

  const { map, player, world } = gameState;
  const tileSize = 16;
  const viewportWidth = 40; // tiles visible horizontally
  const viewportHeight = 25; // tiles visible vertically
  
  // Debug logging
  console.log("DungeonRenderer debug:", {
    mapWidth: map.width,
    mapHeight: map.height,
    playerPos: player ? { x: player.x, y: player.y } : "no player",
    tiles: map.tiles,
    tilesKeys: map.tiles ? Object.keys(map.tiles) : [],
    tilesItems: map.tiles?.items,
    tilesLength: map.tiles?.items?.length,
    tilesType: typeof map.tiles,
    tilesConstructor: map.tiles?.constructor?.name,
    sampleTiles: map.tiles?.items ? Array.from(map.tiles.items).slice(0, 20) : [],
    worldSize: world?.size,
    worldKeys: world ? Array.from(world.keys()) : []
  });

  // Check what's around the player
  if (player && map.tiles) {
    const playerTileIndex = player.y * map.width + player.x;
    let playerTileValue;
    if (map.tiles.items) {
      playerTileValue = map.tiles.items[playerTileIndex];
    } else if (Array.isArray(map.tiles)) {
      playerTileValue = map.tiles[playerTileIndex];
    }
    console.log("Player standing on tile:", playerTileValue, "at index:", playerTileIndex);
    
    // Check surrounding tiles
    const surroundingTiles = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const checkX = player.x + dx;
        const checkY = player.y + dy;
        if (checkX >= 0 && checkX < map.width && checkY >= 0 && checkY < map.height) {
          const tileIndex = checkY * map.width + checkX;
          let tileValue;
          if (map.tiles.items) {
            tileValue = map.tiles.items[tileIndex];
          } else if (Array.isArray(map.tiles)) {
            tileValue = map.tiles[tileIndex];
          }
          surroundingTiles.push({ x: checkX, y: checkY, tile: tileValue });
        }
      }
    }
    console.log("Surrounding tiles:", surroundingTiles);
    console.log("Map dimensions:", map.width, "x", map.height);
    console.log("Player at:", player.x, player.y, "within bounds?", 
      player.x >= 0 && player.x < map.width && player.y >= 0 && player.y < map.height);
  }
  
  // Add specific player position logging
  if (player) {
    console.log(`Player object:`, player);
    console.log(`Player at (${player.x}, ${player.y})`);
    console.log(`Player keys:`, Object.keys(player));
  }
  
  // Calculate camera position to center on player
  let cameraX = 0;
  let cameraY = 0;
  if (player) {
    cameraX = Math.max(0, Math.min(player.x - viewportWidth / 2, map.width - viewportWidth));
    cameraY = Math.max(0, Math.min(player.y - viewportHeight / 2, map.height - viewportHeight));
  }
  
  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      display: 'grid',
      gridTemplateColumns: `repeat(${viewportWidth}, ${tileSize}px)`,
      gridTemplateRows: `repeat(${viewportHeight}, ${tileSize}px)`,
      gap: '1px',
      backgroundColor: '#000',
      padding: '10px',
      borderRadius: '8px',
      border: '2px solid #444'
    }}>
      {Array.from({ length: viewportHeight * viewportWidth }).map((_, index) => {
        const vx = index % viewportWidth;
        const vy = Math.floor(index / viewportWidth);
        const worldX = Math.floor(cameraX + vx);
        const worldY = Math.floor(cameraY + vy);
        
        // Check if this tile is within the actual map bounds
        if (worldX >= map.width || worldY >= map.height || worldX < 0 || worldY < 0) {
          return (
            <div
              key={index}
              style={{
                width: `${tileSize}px`,
                height: `${tileSize}px`,
                backgroundColor: '#000',
                borderRadius: '1px'
              }}
            />
          );
        }
        
        const tileIndex = worldY * map.width + worldX;
        let tileValue;
        try {
          // Try different ways to access the tiles data
          if (map.tiles.items) {
            tileValue = map.tiles.items[tileIndex];
          } else if (Array.isArray(map.tiles)) {
            tileValue = map.tiles[tileIndex];
          } else if (map.tiles && typeof map.tiles === 'object') {
            tileValue = map.tiles[tileIndex];
          }
        } catch (e) {
          console.warn("Error accessing tile data:", e);
          tileValue = 0; // Default to floor
        }
        const isPlayer = player && player.x === worldX && player.y === worldY;
        
        // Check for items at this position
        const itemKey = `${worldX},${worldY}`;
        const hasItem = world && world.has(itemKey);
        
        // Determine tile appearance
        let backgroundColor = '#1a1a1a'; // default unknown
        let border = 'none';
        let borderRadius = '1px';
        
        if (isPlayer) {
          backgroundColor = '#ff4444';
          border = '2px solid #ff0000';
          borderRadius = '50%';
        } else if (hasItem) {
          backgroundColor = '#4444ff';
          border = '1px solid #6666ff';
          borderRadius = '25%';
        } else if (tileValue === 1) {
          backgroundColor = '#2a2a2a'; // wall - darker
          border = '1px solid #1a1a1a';
        } else if (tileValue === 0) {
          backgroundColor = '#8b7355'; // floor
        } else {
          // Unknown tile type - make it visible
          backgroundColor = '#ffaa00';
          border = '1px solid #ff8800';
        }
        
        return (
          <div
            key={index}
            style={{
              width: `${tileSize}px`,
              height: `${tileSize}px`,
              backgroundColor,
              border,
              borderRadius,
              boxSizing: 'border-box'
            }}
          />
        );
      })}
    </div>
  );
};

export default function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInventory, setShowInventory] = useState(false);

  useEffect(() => {
    // Set up game client event listeners
    gameClient.onStateChange((state: GameState) => {
      console.log("App.tsx onStateChange - New state:", state);
      console.log("App.tsx onStateChange - Player position:", state?.player?.x, state?.player?.y);
      setGameState(state);
    });

    gameClient.onConnect(() => {
      setIsConnected(true);
      setError(null);
    });

    gameClient.onError((err: any) => {
      setError(err.message || err.toString());
      setIsConnected(false);
    });

    // Cleanup on unmount
    return () => {
      gameClient.disconnect();
    };
  }, []);

  const handleConnect = async () => {
    try {
      setError(null);
      // Pass dungeon generation options - you can change these to test different algorithms
      const options = {
        width: 60,
        height: 30,
        algorithm: 'rooms_corridors' // Try: 'bsp', 'cellular', 'drunkard', 'rooms_corridors'
      };
      await gameClient.joinRoom("my_room", options);
    } catch (err: any) {
      setError(err.message || err.toString());
    }
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', backgroundColor: '#1a1a1a' }}>
      <DungeonRenderer key={`player-${gameState?.player?.x}-${gameState?.player?.y}`} gameState={gameState} />
      
      <KeyboardControls enabled={isConnected} onToggleInventory={() => setShowInventory(!showInventory)} />
      
      <GameUI 
        gameState={gameState}
        onConnect={handleConnect}
        isConnected={isConnected}
        error={error}
        onToggleInventory={() => setShowInventory(!showInventory)}
      />
      
      <InventoryHUD 
        isVisible={showInventory}
        onClose={() => setShowInventory(false)}
        playerState={gameState?.player}
      />
    </div>
  );
}
