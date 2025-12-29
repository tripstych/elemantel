import React, { useEffect, useRef, useState } from "react";
import { Sprite as PixiSprite, Container as PixiContainer, Graphics as PixiGraphics, Application as PixiApplication, Texture as PixiTexture } from "pixi.js";
import { tileManager } from "../services/TileManager";
import { GameState, gameClient } from "../services/GameClient";
import { GAME_CONSTANTS } from "../../../shared/constants";

interface DungeonMapProps {
  gameState: GameState | null;
  tileSize?: number;
  app: PixiApplication;
}

const TILE_SIZE = 32;

// Imperative rendering via pixi.js directly (avoids missing @pixi/react component exports)

export const DungeonMap: React.FC<DungeonMapProps> = ({ 
  gameState, 
  tileSize = TILE_SIZE,
  app
}) => {
  console.log("DungeonMap component called with gameState:", !!gameState);
  const layerRef = useRef<PixiContainer | null>(null);
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

    gameClient.onAutoNavigateComplete(() =>
    
    
    {
      setHighlightedPath([]);
      console.log("Navigation complete, clearing path");
    });

    gameClient.onAutoNavigateStopped(() => {
      setHighlightedPath([]);
      console.log("Navigation stopped, clearing path");
    });
  }, []);

  // Pixel texture prepared during assets loading effect below

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
  const hpBarTexture = tileManager.getAsset("hpbar");

  // Find the current player from state
  const currentPlayer = (gameState as any).player || (players && typeof (players as any).values === 'function' ? (players as Map<string, any>).values().next().value : null);
  
  // Calculate camera offset to center the player on screen
  const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 800;
  const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 600;
  const cameraOffsetX = screenWidth / 2 - (currentPlayer ? currentPlayer.x * tileSize + tileSize / 2 : 0);
  const cameraOffsetY = screenHeight / 2 - (currentPlayer ? currentPlayer.y * tileSize + tileSize / 2 : 0);
  // Imperative render to Pixi stage
  useEffect(() => {
    if (!gameState || !assetsLoaded || !app) return;
    if (layerRef.current) {
      layerRef.current.destroy(true);
      layerRef.current = null;
    }
    app.stage.sortableChildren = true;
    const layer = new PixiContainer();
    layer.sortableChildren = true;
    layerRef.current = layer;

    // Transparent capture overlay
    const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 800;
    const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 600;
    const overlay = new PixiGraphics();
    overlay.rect(0, 0, screenWidth, screenHeight).fill({ color: 0x000000, alpha: 0 });
    overlay.eventMode = 'static';
    overlay.on('pointertap', (event: any) => {
      // FederatedPointerEvent
      const clickX = event.global.x;
      const clickY = event.global.y;
      const adjustedX = clickX - cameraOffsetX;
      const adjustedY = clickY - cameraOffsetY;
      const tileX = Math.floor(adjustedX / tileSize);
      const tileY = Math.floor(adjustedY / tileSize);
      if (tileX >= 0 && tileX < map.width && tileY >= 0 && tileY < map.height) {
        handleTileClick(tileX, tileY);
      }
    });
    layer.addChild(overlay);

    // Render tiles, items, monsters
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const tile = map.tiles[y]?.tiles[x];
        if (!tile) continue;
        const isWall = tile.terrain === 1;
        const texture = isWall ? wallTexture : floorTexture;
        const tileSprite = new PixiSprite(texture);
        tileSprite.x = x * tileSize + cameraOffsetX;
        tileSprite.y = y * tileSize + cameraOffsetY;
        // Highlighted path tint
        const isHighlighted = highlightedPath.some(p => p.x === x && p.y === y);
        tileSprite.tint = isHighlighted ? 0x00FF00 : 0xFFFFFF;
        tileSprite.alpha = isHighlighted ? 0.7 : 1.0;
        layer.addChild(tileSprite);

        // Items
        tile.items.forEach(() => {
          const s = new PixiSprite(itemTexture);
          s.x = x * tileSize + cameraOffsetX;
          s.y = y * tileSize + cameraOffsetY;
          layer.addChild(s);
        });

        // Monsters
        tile.monsters.forEach((monster: any) => {
          const m = new PixiSprite(enemyTexture);
          m.x = x * tileSize + cameraOffsetX;
          m.y = y * tileSize + cameraOffsetY;
          m.zIndex = 2;
          layer.addChild(m);
        });
      }
    }

    // Players with HP bar sprite above the sprite
    const renderPlayer = (player: any) => {
      const p = new PixiSprite(playerTexture);
      p.x = player.x * tileSize + cameraOffsetX;
      p.y = player.y * tileSize + cameraOffsetY;
      p.zIndex = 3;
      layer.addChild(p);

      const barX = player.x;
      const barY = player.y;
      const bar = new PixiSprite(hpBarTexture || PixiTexture.WHITE);
      bar.width = 32;
      bar.height = 3;
      bar.x = barX;
      bar.y = barY - 32;
      bar.zIndex = 1000;
      layer.addChild(bar);
    };
    if (players && typeof (players as any).forEach === 'function') {
      (players as Map<string, any>).forEach((player: any) => renderPlayer(player));
    } else if (currentPlayer) {
      renderPlayer(currentPlayer);
    }

    layer.sortChildren();
    app.stage.sortChildren();

    app.stage.addChild(layer);

    return () => {
      if (layerRef.current) {
        app.stage.removeChild(layerRef.current);
        layerRef.current.destroy(true);
        layerRef.current = null;
      }
    };
  }, [gameState, assetsLoaded, tileSize, highlightedPath]);

  return null;
};
