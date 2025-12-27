import React, { useState, useEffect } from 'react';
import { GameClient, gameClient } from './services/GameClient';
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
        const tileValue = map.tiles.items[tileIndex]; // Access via .items for Colyseus ArraySchema
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
          backgroundColor = '#4a4a4a'; // wall
        } else if (tileValue === 0) {
          backgroundColor = '#8b7355'; // floor
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
      // Pass dungeon generation options
      const options = {
        width: 60,
        height: 30,
        algorithm: 'bsp' // Try: 'bsp', 'cellular', 'drunkard', 'rooms_corridors'
      };
      await gameClient.joinRoom("my_room", options);
    } catch (err: any) {
      setError(err.message || err.toString());
    }
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', backgroundColor: '#1a1a1a' }}>
      <DungeonRenderer gameState={gameState} />
      
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
