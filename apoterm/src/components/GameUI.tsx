import React from "react";
import { GameState } from "../services/GameClient";

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
        <div>E/Space - Pickup Item</div>
        <div>Q - Attack/Action</div>
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
