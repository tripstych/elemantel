import React, { useEffect, useRef, useState } from "react";
import { Application as PixiApplication } from "pixi.js";
import type { GameState } from "../services/GameClient";
import { DungeonMap } from "./DungeonMap";

interface PixiStageProps {
  gameState: GameState | null;
}

export const PixiStage: React.FC<PixiStageProps> = ({ gameState }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [app, setApp] = useState<PixiApplication | null>(null);

  useEffect(() => {
    let destroyed = false;
    const init = async () => {
      const width = typeof window !== 'undefined' ? window.innerWidth : 800;
      const height = typeof window !== 'undefined' ? window.innerHeight : 600;
      const application = new PixiApplication();
      await application.init({ width, height, backgroundAlpha: 0, antialias: false });
      if (destroyed) {
        application.destroy(true);
        return;
      }
      setApp(application);
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
        containerRef.current.appendChild(application.canvas);
      }
    };
    init();

    const handleResize = () => {
      if (!app) return;
      const width = window.innerWidth;
      const height = window.innerHeight;
      app.renderer.resize(width, height);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      destroyed = true;
      window.removeEventListener('resize', handleResize);
      if (app) {
        app.destroy(true);
      }
    };
  }, []);

  return (
    <div style={{ position: 'absolute', inset: 0 }} ref={containerRef}>
      {app && gameState && (
        <DungeonMap gameState={gameState} app={app} />
      )}
    </div>
  );
};
