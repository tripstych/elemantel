import React, { useEffect, useRef, useState } from "react";
import { Texture, Sprite as PixiSprite, Container as PixiContainer, Graphics as PixiGraphics, Application as PixiApplication } from "pixi.js";
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
  const [pixelTexture, setPixelTexture] = useState<Texture | null>(null);

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
        // Prepare 1x1 pixel texture
        const pxCanvas = document.createElement('canvas');
        pxCanvas.width = 1;
        pxCanvas.height = 1;
        const pctx = pxCanvas.getContext('2d');
        if (pctx) {
          pctx.fillStyle = '#ffffff';
          pctx.fillRect(0, 0, 1, 1);
        }
        setPixelTexture(Texture.from(pxCanvas));
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

  // Find the current player from state
  const currentPlayer = (gameState as any).player || (players && typeof (players as any).values === 'function' ? (players as Map<string, any>).values().next().value : null);
  
  // Calculate camera offset to center the player
  const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 800;
  const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 600;
  // Imperative render to Pixi stage
  useEffect(() => {
    if (!gameState || !assetsLoaded || !app) return;
    if (layerRef.current) {
      layerRef.current.destroy(true);
      layerRef.current = null;
    }
    const layer = new PixiContainer();
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

    // Render tiles, items, monsters, players
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

        // Monsters + HP bars
        tile.monsters.forEach((monster: any, index: number) => {
          const m = new PixiSprite(enemyTexture);
          m.x = x * tileSize + cameraOffsetX;
          m.y = y * tileSize + cameraOffsetY;
          layer.addChild(m);

          const hp = Number(monster.hp ?? 0);
          const maxHp = 20;
          const pct = Math.max(0, Math.min(1, maxHp > 0 ? hp / maxHp : 0));
          const barWidth = Math.max(1, Math.floor(tileSize * pct));
          const barHeight = 3;
          const barX = x * tileSize + cameraOffsetX;
          const barY = y * tileSize + cameraOffsetY - (4 + index * (barHeight + 1));
          if (pixelTexture) {
            for (let row = 0; row < barHeight; row++) {
              for (let col = 0; col < tileSize; col++) {
                const px = new PixiSprite(pixelTexture);
                px.x = barX + col;
                px.y = barY + row;
                px.tint = 0x660000;
                layer.addChild(px);
              }
            }
            for (let row = 0; row < barHeight; row++) {
              for (let col = 0; col < barWidth; col++) {
                const px = new PixiSprite(pixelTexture);
                px.x = barX + col;
                px.y = barY + row;
                px.tint = 0xCC0000;
                layer.addChild(px);
              }
            }
          }
        });
      }
    }

    // Players + HP bars
    const renderPlayer = (player: any) => {
      const p = new PixiSprite(playerTexture);
      p.x = player.x * tileSize + cameraOffsetX;
      p.y = player.y * tileSize + cameraOffsetY;
      layer.addChild(p);

      const hp = Number(player.hp ?? 0);
      const maxHp = Number(player.max_hp ?? 0) || 1;
      const pct = Math.max(0, Math.min(1, maxHp > 0 ? hp / maxHp : 0));
      const barWidth = Math.max(1, Math.floor(tileSize * pct));
      const barHeight = 4;
      const barX = player.x * tileSize + cameraOffsetX;
      const barY = player.y * tileSize + cameraOffsetY - 5;
      if (pixelTexture) {
        for (let row = 0; row < barHeight; row++) {
          for (let col = 0; col < tileSize; col++) {
            const px = new PixiSprite(pixelTexture);
            px.x = barX + col;
            px.y = barY + row;
            px.tint = 0x333333;
            layer.addChild(px);
          }
        }
        for (let row = 0; row < barHeight; row++) {
          for (let col = 0; col < barWidth; col++) {
            const px = new PixiSprite(pixelTexture);
            px.x = barX + col;
            px.y = barY + row;
            px.tint = 0xCC0000;
            layer.addChild(px);
          }
        }
      }
    };
    if (players && typeof (players as any).forEach === 'function') {
      (players as Map<string, any>).forEach((player: any) => renderPlayer(player));
    } else if (currentPlayer) {
      renderPlayer(currentPlayer);
    }

    app.stage.addChild(layer);

    return () => {
      if (layerRef.current) {
        app.stage.removeChild(layerRef.current);
        layerRef.current.destroy(true);
        layerRef.current = null;
      }
    };
  }, [gameState, assetsLoaded, pixelTexture, tileSize, highlightedPath]);

  return null;
};
