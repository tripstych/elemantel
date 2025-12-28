import React, { useState, useEffect } from 'react';
import { gameClient, GameState } from './services/GameClient';
import { InventoryHUD } from './components/InventoryHUD';
import { KeyboardControls } from "./components/KeyboardControls";
import { GameUI } from "./components/GameUI";
import { MessageHUD } from "./components/MessageHUD";
import { GAME_CONSTANTS } from "../../shared/constants";

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
