import React, { useState, useEffect } from 'react';
import { gameClient, GameState } from './services/GameClient';
import { InventoryHUD } from './components/InventoryHUD';
import { KeyboardControls } from "./components/KeyboardControls";
import { GameUI } from "./components/GameUI";
import { MessageHUD } from "./components/MessageHUD";
import { GAME_CONSTANTS } from "../../shared/constants";

// Simple CSS-based dungeon renderer
const DungeonRenderer: React.FC<{ gameState: any }> = ({ gameState }) => {
  if (!gameState || !gameState.map) return null;

  const { map, player, world } = gameState;
  const tileSize = GAME_CONSTANTS.TILE_SIZE;
  const viewportWidth = 40; // tiles visible horizontally
  const viewportHeight = 25; // tiles visible vertically
  
  const handleTileClick = (worldX: number, worldY: number) => {
    if (GAME_CONSTANTS.DEBUG) console.log(`[DEBUG] CSS Tile clicked at (${worldX}, ${worldY})`);
    
    // Check if the tile is a floor (not a wall)
    const tileIndex = worldY * map.width + worldX;
    let tileValue;
    if (map.tiles.items) {
      tileValue = map.tiles.items[tileIndex];
    } else if (Array.isArray(map.tiles)) {
      tileValue = map.tiles[tileIndex];
    }
    
    if (GAME_CONSTANTS.DEBUG) console.log(`[DEBUG] Tile value at (${worldX}, ${worldY}):`, tileValue);
    
    if (tileValue === GAME_CONSTANTS.TILE_TYPES.WALL) {
      if (GAME_CONSTANTS.DEBUG) console.log(`[DEBUG] Cannot navigate to wall tile at (${worldX}, ${worldY})`);
      return;
    }
    
    // Check if there's a monster at the clicked position
    const clickedKey = `${worldX},${worldY}`;
    const hasMonster = world && world.has(clickedKey) && world.get(clickedKey).type === 'monster';
    
    if (hasMonster) {
      // If there's a monster, do melee attack
      if (GAME_CONSTANTS.DEBUG) console.log(`[DEBUG] Monster at clicked position -> melee attack`);
      gameClient.meleeAttack();
    } else {
      // If no monster, use pathfinder to navigate
      if (GAME_CONSTANTS.DEBUG) console.log(`[DEBUG] No monster at clicked position -> pathfinding to (${worldX}, ${worldY})`);
      gameClient.autoNavigate(worldX, worldY);
    }
  };
  
  // Debug logging
  if (GAME_CONSTANTS.DEBUG) console.log("DungeonRenderer debug:", {
    mapWidth: map.width,
    mapHeight: map.height,
    playerPos: player ? { x: player.x, y: player.y } : "no player",
    tiles: map.tiles,
    tilesKeys: map.tiles ? Object.keys(map.tiles) : [],
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
        const item = hasItem && world ? world.get(itemKey) : null;
        const isMonster = item && item.type === 'monster';
        
        // Determine tile appearance
        let backgroundColor = '#1a1a1a'; // default unknown
        let border = 'none';
        let borderRadius = '1px';
        
        if (isPlayer) {
          backgroundColor = '#ff4444';
          border = '2px solid #ff0000';
          borderRadius = '50%';
        } else if (isMonster) {
          // Render monsters as green triangles/circles
          backgroundColor = '#44ff44';
          border = '2px solid #00ff00';
          borderRadius = '50%';
        } else if (hasItem) {
          backgroundColor = '#4444ff';
          border = '1px solid #6666ff';
          borderRadius = '25%';
        } else if (tileValue === GAME_CONSTANTS.TILE_TYPES.WALL) {
          backgroundColor = '#2a2a2a'; // wall - darker
          border = '1px solid #1a1a1a';
        } else if (tileValue === GAME_CONSTANTS.TILE_TYPES.FLOOR) {
          backgroundColor = '#8b7355'; // floor
        } else {
          // Unknown tile type - make it visible
          backgroundColor = '#ffaa00';
          border = '1px solid #ff8800';
        }
        
        return (
          <div
            key={index}
            onClick={() => handleTileClick(worldX, worldY)}
            style={{
              position: 'relative',
              width: `${tileSize}px`,
              height: `${tileSize}px`,
              backgroundColor,
              border,
              borderRadius,
              boxSizing: 'border-box',
              cursor: tileValue === GAME_CONSTANTS.TILE_TYPES.FLOOR ? 'pointer' : 'default'
            }}
          >
            {/* HP gauge above player and monsters */}
            {(() => {
              const hpFraction = isPlayer
                ? Math.max(0, Math.min(1, (player?.hp ?? 0) / Math.max(1, player?.max_hp ?? 1)))
                : isMonster
                  ? 1
                  : null;

              if (hpFraction === null) return null;
              const HP_BAR_HEIGHT = 2;
              return (
                <div
                  style={{
                    position: 'absolute',
                    top: `-6px`,
                    left: 0,
                    width: `${tileSize}px`,
                    height: `${HP_BAR_HEIGHT}px`,
                    backgroundColor: '#330000',
                    pointerEvents: 'none',
                  }}
                >
                  <div
                    style={{
                      width: `${Math.round(hpFraction * tileSize)}px`,
                      height: '100%',
                      backgroundColor: '#ff0000',
                    }}
                  />
                </div>
              );
            })()}
          </div>
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
      if (GAME_CONSTANTS.DEBUG) {
        console.log("App.tsx onStateChange - New state:", state);
        console.log("App.tsx onStateChange - Player position:", state?.player?.x, state?.player?.y);
      }
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

      {/* Pixi Message HUD overlay (lower-right) */}
      {isConnected && (
        <div
          style={{
            position: 'absolute',
            bottom: '10px',
            right: '10px',
            width: '320px',
            height: '180px',
            pointerEvents: 'auto',
            zIndex: 1000,
            background: 'rgba(0,0,0,0.6)',
            borderRadius: '8px',
            border: '2px solid #444',
          }}
        >
          <MessageHUD width={320} height={180} />
        </div>
      )}
      
    </div>
  );
}
