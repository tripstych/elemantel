import React, { useEffect, useCallback } from "react";
import { gameClient } from "../services/GameClient";

interface KeyboardControlsProps {
  enabled?: boolean;
  onToggleInventory?: () => void;
}

export const KeyboardControls: React.FC<KeyboardControlsProps> = ({ 
  enabled = true,
  onToggleInventory
}) => {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    console.log("Key pressed:", event.key, "enabled:", enabled, "connected:", gameClient.isConnected());
    
    if (!enabled || !gameClient.isConnected()) {
      console.log("Movement blocked - enabled:", enabled, "connected:", gameClient.isConnected());
      return;
    }

    switch (event.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        event.preventDefault();
        console.log("Moving up");
        gameClient.move(0, -1);
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        event.preventDefault();
        console.log("Moving down");
        gameClient.move(0, 1);
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        event.preventDefault();
        console.log("Moving left");
        gameClient.move(-1, 0);
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        event.preventDefault();
        console.log("Moving right");
        gameClient.move(1, 0);
        break;
      case ' ':
      case 'e':
      case 'E':
        event.preventDefault();
        console.log("Picking up item");
        gameClient.pickup();
        break;
      case 'q':
      case 'Q':
        event.preventDefault();
        console.log("Attack/action");
        gameClient.pickup();
        break;
      case 'i':
      case 'I':
        event.preventDefault();
        console.log("Toggle inventory");
        if (onToggleInventory) {
          onToggleInventory();
        }
        break;
      case 'F5':
        event.preventDefault();
        console.log("Quick save");
        gameClient.saveGame();
        break;
      case 'F9':
        event.preventDefault();
        console.log("Load game");
        gameClient.loadGame();
        break;
    }
  }, [enabled, onToggleInventory]);

  useEffect(() => {
    if (enabled) {
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [enabled, handleKeyDown]);

  return null; // This component doesn't render anything
};
