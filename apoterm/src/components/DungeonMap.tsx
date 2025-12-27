import React, { useEffect, useState } from "react";
import { Texture } from "pixi.js";
import { Application, Sprite, Container } from "@pixi/react";
import { tileManager } from "../services/TileManager";
import { GameState } from "../services/GameClient";

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
}

const Tile: React.FC<TileProps> = ({ x, y, texture, tileSize }) => {
  return (
    <Sprite
      texture={texture}
      x={x * tileSize}
      y={y * tileSize}
      width={tileSize}
      height={tileSize}
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
  const [assetsLoaded, setAssetsLoaded] = useState(false);

  useEffect(() => {
    console.log("DungeonMap gameState updated:", gameState);
  }, [gameState]);

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

  const { map, players, world } = gameState;
  const floorTexture = tileManager.getAsset("floor");
  const wallTexture = tileManager.getAsset("wall");
  const playerTexture = tileManager.getAsset("player");
  const itemTexture = tileManager.getAsset("item");

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
  
  // Access the actual tiles array from the nested structure
  const tilesArray = (map.tiles as any).items || [];
  
  console.log("Tiles array:", {
    length: tilesArray.length,
    firstFew: tilesArray.slice(0, 20),
    hasWalls: tilesArray.includes(1),
    hasFloors: tilesArray.includes(0)
  });
  
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      // Use flat array index calculation
      const tileIndex = y * map.width + x;
      const tileValue = tilesArray[tileIndex];
      
      // Debug first few tiles
      if (y === 0 && x < 10) {
        console.log(`Tile at (${x},${y}) index ${tileIndex}: value ${tileValue}`);
      }
      
      const isWall = tileValue === 1; // 1 = wall, 0 = floor
      
      if (isWall) wallCount++;
      else floorCount++;
      
      const texture = isWall ? wallTexture : floorTexture;
      
      mapTiles.push(
        <Tile
          key={`tile-${x}-${y}`}
          x={x}
          y={y}
          texture={texture}
          tileSize={tileSize}
        />
      );
    }
  }
  
  console.log(`Frontend rendering: ${wallCount} walls, ${floorCount} floors`);

  // Render items
  const itemEntities: React.ReactElement[] = [];
  world.forEach((item, key) => {
    const [x, y] = key.split(',').map(Number);
    if (!isNaN(x) && !isNaN(y)) {
      itemEntities.push(
        <Entity
          key={`item-${key}`}
          x={x}
          y={y}
          texture={itemTexture}
          tileSize={tileSize}
        />
      );
    }
  });

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
    >
      {/* Map tiles */}
      {mapTiles}
      
      {/* Items */}
      {itemEntities}
      
      {/* Players */}
      {playerEntities}
    </pixiContainer>
  );
};
