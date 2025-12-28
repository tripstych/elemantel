import React, { useEffect, useState } from "react";
import { Texture } from "pixi.js";
import { tileManager } from "../services/TileManager";
import { GameState, gameClient } from "../services/GameClient";
import { GAME_CONSTANTS } from "../../../shared/constants";

interface DungeonMapProps {
  gameState: GameState | null;
  tileSize?: number;
}

const TILE_SIZE = 32;

interface TileProps {
  x: number;
  y: number;
  texture: Texture;
  tileSize: number;
  isHighlighted?: boolean;
}

const Tile: React.FC<TileProps> = ({ x, y, texture, tileSize, isHighlighted = false }) => {
  console.log(`[DEBUG] Rendering Tile at (${x}, ${y}), interactive: true, highlighted: ${isHighlighted}`);

  return (
    <Sprite
      texture={texture}
      x={x * tileSize}
      y={y * tileSize}
      width={tileSize}
      height={tileSize}
      tint={isHighlighted ? 0x00FF00 : 0xFFFFFF} // Green tint for highlighted path
      alpha={isHighlighted ? 0.7 : 1.0}
    />
  );
};

interface EntityProps {
  x: number;
  y: number;
  texture: Texture;
  tileSize: number;
}

const Entity: React.FC<EntityProps> = ({ x, y, texture, tileSize }) => {
  return (
    <pixiSprite
      texture={texture}
      x={x * tileSize + tileSize / 2}
      y={y * tileSize + tileSize / 2}
      width={tileSize}
      height={tileSize}
      anchor={0.5}
    />
  );
};

export const DungeonMap: React.FC<DungeonMapProps> = ({ 
  gameState, 
  tileSize = TILE_SIZE 
}) => {
  console.log("DungeonMap component called with gameState:", !!gameState);
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const [highlightedPath, setHighlightedPath] = useState<Array<{x: number, y: number}>>([]);

  useEffect(() => {
    console.log("DungeonMap gameState updated:", gameState);
  }, [gameState]);

  // Set up autonavigation event listeners
  useEffect(() => {
    gameClient.onAutoNavigateResult((result) => {
      if (result.success) {
        setHighlightedPath(result.path);
        console.log("Path highlighted:", result.path);
      } else {
        setHighlightedPath([]);
        console.log("No path found:", result.message);
      }
    });

    gameClient.onAutoNavigateComplete(() => {
      setHighlightedPath([]);
      console.log("Navigation complete, clearing path");
    });

    gameClient.onAutoNavigateStopped(() => {
      setHighlightedPath([]);
      console.log("Navigation stopped, clearing path");
    });
  }, []);

  const handleTileClick = (x: number, y: number) => {
    console.log(`[DEBUG] handleTileClick called at (${x}, ${y})`);
    console.log(`[DEBUG] gameState available:`, !!gameState);
    
    if (!gameState) {
      console.log(`[DEBUG] No gameState available, returning`);
      return;
    }
    
    // Only navigate to floor tiles (not walls)
    if (!gameState!.map.tiles[y] || !gameState!.map.tiles[y].tiles[x]) {
      console.log(`[DEBUG] Invalid tile coordinates at (${x}, ${y})`);
      return;
    }
    
    const tile = gameState!.map.tiles[y].tiles[x];
    console.log(`[DEBUG] Tile at (${x}, ${y}):`, tile);
    
    if (tile.terrain === 1) {
      console.log(`[DEBUG] Cannot navigate to wall tile at (${x}, ${y})`);
      return;
    }
    
    console.log(`[DEBUG] Starting autonavigation to (${x}, ${y})`);
    // Start autonavigation
    gameClient.autoNavigate(x, y);
    console.log(`[DEBUG] autoNavigate called for (${x}, ${y})`);
  };

  const handleStageClick = (event: any) => {
    console.log(`[DEBUG] Stage click event:`, event);
    
    // Get click position relative to stage
    const clickX = event.data.global.x;
    const clickY = event.data.global.y;
    
    console.log(`[DEBUG] Click at global position: (${clickX}, ${clickY})`);
    
    // Adjust for camera offset
    const adjustedX = clickX - cameraOffsetX;
    const adjustedY = clickY - cameraOffsetY;
    
    console.log(`[DEBUG] Adjusted position: (${adjustedX}, ${adjustedY})`);
    
    // Convert to tile coordinates
    const tileX = Math.floor(adjustedX / tileSize);
    const tileY = Math.floor(adjustedY / tileSize);
    
    console.log(`[DEBUG] Tile coordinates: (${tileX}, ${tileY})`);
    
    // Check if within map bounds
    if (tileX >= 0 && tileX < gameState!.map.width && tileY >= 0 && tileY < gameState!.map.height) {
      console.log(`[DEBUG] Valid tile coordinates, calling handleTileClick`);
      handleTileClick(tileX, tileY);
    } else {
      console.log(`[DEBUG] Click outside map bounds`);
    }
  };

  useEffect(() => {
    const loadAssets = async () => {
      try {
        await tileManager.loadAssets();
        setAssetsLoaded(true);
        console.log("Tile assets loaded for dungeon map");
      } catch (error) {
        console.error("Failed to load tile assets:", error);
        setAssetsLoaded(true); // Continue with placeholders
      }
    };

    loadAssets();
  }, []);

  if (!gameState || !assetsLoaded) {
    console.log("DungeonMap not rendering - gameState:", !!gameState, "assetsLoaded:", assetsLoaded);
    return null;
  }

  const { map, players } = gameState;
  const floorTexture = tileManager.getAsset("floor");
  const wallTexture = tileManager.getAsset("wall");
  const playerTexture = tileManager.getAsset("player");
  const itemTexture = tileManager.getAsset("item");
  const enemyTexture = tileManager.getAsset("enemy");

  // Find the current player (first player in the map)
  const currentPlayer = players.values().next().value;
  
  // Calculate camera offset to center the player
  const screenWidth = 800;
  const screenHeight = 600;
  
  let cameraOffsetX = 0;
  let cameraOffsetY = 0;
  
  if (currentPlayer) {
    // Center camera on player
    cameraOffsetX = screenWidth / 2 - (currentPlayer.x * tileSize + tileSize / 2);
    cameraOffsetY = screenHeight / 2 - (currentPlayer.y * tileSize + tileSize / 2);
  }

  // Render map tiles
  const mapTiles: React.ReactElement[] = [];
  let wallCount = 0;
  let floorCount = 0;
  
  console.log("Full map structure:", map);
  console.log("Map tiles type:", typeof map.tiles);
  console.log("Map tiles constructor:", map.tiles?.constructor?.name);
  console.log("First tile row:", map.tiles[0]);
  console.log("First tile row tiles type:", typeof map.tiles[0]?.tiles);
  console.log("Rendering map with new tile structure:", {
    width: map.width,
    height: map.height,
    tileRows: map.tiles.length,
    firstTileRow: map.tiles[0],
    firstTile: map.tiles[0]?.tiles[0]
  });
  
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      // Use new tile structure
      const tile = map.tiles[y]?.tiles[x];
      
      if (!tile) {
        console.warn(`Missing tile at (${x}, ${y})`);
        continue;
      }
      
      // Debug first few tiles
      if (y === 0 && x < 10) {
        const isWall = tile.terrain === 1;
        console.log(`Tile at (${x},${y}):`, {
          tile: tile,
          terrain: tile?.terrain,
          isWall: isWall,
          texture: isWall ? 'wall' : 'floor'
        });
      }
      
      const isWall = tile.terrain === 1; // 1 = wall, 0 = floor
      
      if (isWall) wallCount++;
      else floorCount++;
      
      const texture = isWall ? wallTexture : floorTexture;
      
      // Check if this tile is in the highlighted path
      const isHighlighted = highlightedPath.some(pathTile => pathTile.x === x && pathTile.y === y);
      
      mapTiles.push(
        <Tile
          key={`tile-${x}-${y}`}
          x={x}
          y={y}
          texture={texture}
          tileSize={tileSize}
          isHighlighted={isHighlighted}
        />
      );
    }
  }
  
  console.log(`Frontend rendering: ${wallCount} walls, ${floorCount} floors`);

  // Render items and monsters from tiles
  const itemEntities: React.ReactElement[] = [];
  const monsterEntities: React.ReactElement[] = [];
  
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const tile = map.tiles[y]?.tiles[x];
      if (!tile) continue;
      
      // Render items
      tile.items.forEach((item, index) => {
        itemEntities.push(
          <Entity
            key={`item-${x}-${y}-${index}`}
            x={x}
            y={y}
            texture={itemTexture}
            tileSize={tileSize}
          />
        );
      });
      
      // Render monsters
      tile.monsters.forEach((monster, index) => {
        monsterEntities.push(
          <Entity
            key={`monster-${x}-${y}-${index}`}
            x={x}
            y={y}
            texture={enemyTexture}
            tileSize={tileSize}
          />
        );
      });
    }
  }

  // Render players
  const playerEntities: React.ReactElement[] = [];
  players.forEach((player, sessionId) => {
    playerEntities.push(
      <Entity
        key={`player-${sessionId}`}
        x={player.x}
        y={player.y}
        texture={playerTexture}
        tileSize={tileSize}
      />
    );
  });

  return (
    <pixiContainer 
      position={{ x: cameraOffsetX, y: cameraOffsetY }}
      interactive={true}
      onClick={handleStageClick}
    >
      {/* Map tiles */}
      {mapTiles}
      
      {/* Items */}
      {itemEntities}
      
      {/* Monsters */}
      {monsterEntities}
      
      {/* Players */}
      {playerEntities}
    </pixiContainer>
  );
};
