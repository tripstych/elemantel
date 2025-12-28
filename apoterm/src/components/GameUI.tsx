import React from "react";
import { GameState, gameClient } from "../services/GameClient";
import { GAME_CONSTANTS } from "../../../shared/constants";

// Simple CSS-based dungeon renderer (copied from App.tsx)
const DungeonRenderer: React.FC<{ gameState: any }> = ({ gameState }) => {
  if (!gameState || !gameState.map) return null;

  const { map, player } = gameState;
  const tileSize = GAME_CONSTANTS.TILE_SIZE;
  const viewportWidth = 40; // tiles visible horizontally
  const viewportHeight = 25; // tiles visible vertically
  
  // Debug: Check tile structure
  if (GAME_CONSTANTS.DEBUG && player) {
    const tile = map.tiles[player.y]?.tiles[player.x];
    console.log(`=== RENDER DEBUG ===`);
    console.log(`Player at (${player.x}, ${player.y}) on tile:`, tile);
    console.log(`Tile terrain:`, tile?.terrain);
    console.log(`Map dimensions: ${map.width}x${map.height}`);
    console.log(`Map tiles structure:`, map.tiles);
    console.log(`First few tiles:`, map.tiles.slice(0, 3));
  }
  
  const handleTileClick = (worldX: number, worldY: number) => {
    if (GAME_CONSTANTS.DEBUG) console.log(`[DEBUG] CSS Tile clicked at (${worldX}, ${worldY})`);
    
    // Check if tile is walkable
    const tile = map.tiles[worldY]?.tiles[worldX];
    if (!tile || tile.terrain !== 0) {
      if (GAME_CONSTANTS.DEBUG) console.log(`Cannot navigate to wall or invalid tile at (${worldX}, ${worldY})`);
      return;
    }
    
    gameClient.autoNavigate(worldX, worldY);
  };

  // Calculate viewport offset to center on player
  const viewportOffsetX = Math.max(0, Math.min(player.x - Math.floor(viewportWidth / 2), map.width - viewportWidth));
  const viewportOffsetY = Math.max(0, Math.min(player.y - Math.floor(viewportHeight / 2), map.height - viewportHeight));

  const renderTile = (worldX: number, worldY: number) => {
    // Check if tile is within viewport
    if (worldX < viewportOffsetX || worldX >= viewportOffsetX + viewportWidth ||
        worldY < viewportOffsetY || worldY >= viewportOffsetY + viewportHeight) {
      return null;
    }

    // Check if we have tile data
    if (!map.tiles[worldY]) {
      console.log(`No tile row at y=${worldY}`);
      return null;
    }
    
    if (!map.tiles[worldY].tiles[worldX]) {
      console.log(`No tile at x=${worldX}, y=${worldY}`);
      return null;
    }

    const tile = map.tiles[worldY].tiles[worldX];
    const screenX = (worldX - viewportOffsetX) * tileSize;
    const screenY = (worldY - viewportOffsetY) * tileSize;

    // Debug: Log first few tiles
    if (worldX < 3 && worldY < 3) {
      console.log(`Tile at (${worldX}, ${worldY}):`, tile);
      console.log(`Tile keys:`, Object.keys(tile));
      console.log(`Tile terrain:`, tile.terrain);
      console.log(`Tile.terrain type:`, typeof tile.terrain);
    }

    // Determine tile type and color
    let tileColor = '#000000'; // default black
    let tileContent = null;

    if (tile.terrain === 0) {
      tileColor = '#8b7355'; // floor (brown)
    } else if (tile.terrain === 1) {
      tileColor = '#2a2a2a'; // wall (dark gray)
    } else {
      tileColor = '#ff00ff'; // bright pink for unknown terrain
      console.log(`Unknown terrain value: ${tile.terrain} at (${worldX}, ${worldY})`);
    }

    // Render items on tile
    if (tile.items && tile.items.length > 0) {
      tileContent = (
        <div
          style={{
            position: 'absolute',
            top: '2px',
            left: '2px',
            width: '6px',
            height: '6px',
            backgroundColor: '#4444ff',
            borderRadius: '1px'
          }}
        />
      );
    }

    // Render monsters on tile
    if (tile.monsters && tile.monsters.length > 0) {
      tileContent = (
        <div
          style={{
            position: 'absolute',
            top: '2px',
            left: '2px',
            width: '6px',
            height: '6px',
            backgroundColor: '#ffaa00',
            borderRadius: '50%'
          }}
        />
      );
    }

    // Render player
    if (player.x === worldX && player.y === worldY) {
      tileContent = (
        <div
          style={{
            position: 'absolute',
            top: '1px',
            left: '1px',
            width: '8px',
            height: '8px',
            backgroundColor: '#ff4444',
            borderRadius: '50%'
          }}
        />
      );
    }

    return (
      <div
        key={`${worldX}-${worldY}`}
        style={{
          position: 'absolute',
          left: `${screenX}px`,
          top: `${screenY}px`,
          width: `${tileSize}px`,
          height: `${tileSize}px`,
          backgroundColor: tileColor,
          border: '1px solid rgba(0,0,0,0.2)',
          cursor: 'pointer',
          boxSizing: 'border-box'
        }}
        onClick={() => handleTileClick(worldX, worldY)}
      >
        {tileContent}
      </div>
    );
  };

  return (
    <div
      style={{
        position: 'relative',
        width: `${viewportWidth * tileSize}px`,
        height: `${viewportHeight * tileSize}px`,
        backgroundColor: '#000000',
        border: '2px solid #444444',
        margin: '20px auto'
      }}
    >
      {Array.from({ length: map.height }, (_, y) =>
        Array.from({ length: map.width }, (_, x) => renderTile(x, y))
      )}
    </div>
  );
};

interface GameUIProps {
  gameState: GameState | null;
  onConnect: () => void;
  isConnected: boolean;
  error: string | null;
  onToggleInventory: () => void;
}

export const GameUI: React.FC<GameUIProps> = ({ 
  gameState, 
  onConnect, 
  isConnected, 
  error,
  onToggleInventory
}) => {
  if (!isConnected) {
    return (
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        padding: '20px',
        borderRadius: '10px',
        textAlign: 'center'
      }}>
        <h2>Dungeon Explorer</h2>
        <p>Connect to the game server to begin</p>
        <button 
          onClick={onConnect}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Connect to Game
        </button>
        {error && (
          <div style={{ color: '#ef4444', marginTop: '10px' }}>
            Error: {error}
          </div>
        )}
      </div>
    );
  }

  if (!gameState) {
    return (
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        color: 'white',
        textAlign: 'center'
      }}>
        <p>Loading game state...</p>
      </div>
    );
  }

  console.log("GameUI gameState:", gameState);
  const { player } = gameState;

  if (!player) {
    return (
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        color: 'white',
        textAlign: 'center'
      }}>
        <p>Loading player data...</p>
      </div>
    );
  }

  return (
    <>
      {/* Dungeon Map */}
      <DungeonRenderer gameState={gameState} />
      
      {/* Player Stats Panel */}
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        background: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        padding: '15px',
        borderRadius: '8px',
        minWidth: '200px',
        fontSize: '14px',
        zIndex: 1000
      }}>
        <h3 style={{ margin: '0 0 10px 0' }}>{player.name || 'Player'}</h3>
        <div>HP: {player.hp || 0}/{player.max_hp || 0}</div>
        <div>Mana: {player.mana || 0}</div>
        <div>Position: ({player.x || 0}, {player.y || 0})</div>
        <div>STR: {player.strength || 0} DEX: {player.dexterity || 0}</div>
        <div>CON: {player.constitution || 0} INT: {player.intelligence || 0}</div>
      </div>

      {/* Inventory Panel */}
      <div style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        background: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        padding: '15px',
        borderRadius: '8px',
        minWidth: '200px',
        fontSize: '14px',
        zIndex: 1000
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h3 style={{ margin: 0 }}>Inventory</h3>
          <button
            onClick={onToggleInventory}
            style={{
              backgroundColor: '#4a4a4a',
              color: 'white',
              border: '1px solid #666',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            Manage
          </button>
        </div>
        {player.inventory.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            {player.inventory.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        ) : (
          <div>Empty</div>
        )}
      </div>

      {/* Controls Help */}
      <div style={{
        position: 'absolute',
        bottom: '10px',
        left: '10px',
        background: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        padding: '10px',
        borderRadius: '8px',
        fontSize: '12px',
        zIndex: 1000
      }}>
        <div><strong>Controls:</strong></div>
        <div>Arrow Keys/WASD - Move</div>
        <div>E - Pickup Item</div>
        <div>Space/Q - Melee Attack (AoE)</div>
        <div>I - Toggle Inventory</div>
        <div style={{marginTop: '5px', fontSize: '10px'}}>
          <strong>Legend:</strong><br/>
          <span style={{color: '#ff4444'}}>●</span> Player<br/>
          <span style={{color: '#8b7355'}}>■</span> Floor (walkable)<br/>
          <span style={{color: '#2a2a2a'}}>■</span> Wall (blocked)<br/>
          <span style={{color: '#4444ff'}}>■</span> Item<br/>
          <span style={{color: '#ffaa00'}}>■</span> Unknown
        </div>
      </div>

      {/* Connection Status */}
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0, 255, 0, 0.3)',
        color: 'white',
        padding: '5px 15px',
        borderRadius: '15px',
        fontSize: '12px',
        border: '1px solid rgba(0, 255, 0, 0.5)',
        zIndex: 1000
      }}>
        Connected
      </div>
    </>
  );
};
