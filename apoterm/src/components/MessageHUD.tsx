import React, { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { gameClient } from "../services/GameClient";
import { GAME_CONSTANTS } from "../../../shared/constants";

interface MessageHUDProps {
  width: number;
  height: number;
  maxMessages?: number;
}

interface MsgItem {
  id: number;
  text: string;
  color?: number;
}

export const MessageHUD: React.FC<MessageHUDProps> = ({ width, height, maxMessages = GAME_CONSTANTS.MAX_MESSAGES }) => {
  const [messages, setMessages] = useState<MsgItem[]>([]);
  const [counter, setCounter] = useState(0);

  const pushMessage = (text: string, color?: number) => {
    setMessages(prev => {
      const next = [...prev, { id: counter + 1, text, color }];
      const trimmed = next.slice(Math.max(0, next.length - maxMessages));
      return trimmed;
    });
    setCounter(c => c + 1);
  };

  const formatMsg = (type: string, m: any): string => {
    if (!m) return `[${type}]`;
    if (typeof m === "string") return `[${type}] ${m}`;
    if (m.message) return `[${type}] ${m.message}`;
    try {
      return `[${type}] ${JSON.stringify(m)}`;
    } catch {
      return `[${type}] (unserializable)`;
    }
  };

  useEffect(() => {
    const unsubscribe: Array<() => void> = [];

    // Common helpers
    const ok = GAME_CONSTANTS.COLORS.SUCCESS;
    const warn = GAME_CONSTANTS.COLORS.WARNING;
    const err = GAME_CONSTANTS.COLORS.ERROR;

    // Equip / Unequip via GameClient callbacks
    gameClient.onEquipResult(result => {
      pushMessage(`Equipped ${result.item} -> ${result.slotPath}`, ok);
    });
    gameClient.onUnequipResult(result => {
      pushMessage(`Unequipped ${result.item} from ${result.slotPath}`, warn);
    });

    // Bind direct room message listeners once connected
    const bindRoomHandlers = () => {
      const room = (gameClient as any)["room"];
      if (!room) return;

      const bind = (type: string, fn: (msg: any) => void) => {
        room.onMessage(type, fn);
        // Attempt to unregister on cleanup if API exists
        unsubscribe.push(() => {
          const off = (room as any).removeListener || (room as any).off;
          if (typeof off === "function") {
            try { off.call(room, type, fn); } catch { /* noop */ }
          }
        });
      };

      bind("combat_result", (m: any) => pushMessage(m?.message ?? "Attack executed", ok));
      bind("spacebar_attack_result", (m: any) => pushMessage(m?.message ?? "AoE attack", ok));
      bind("spell_result", (m: any) => pushMessage(m?.message ?? "Spell cast", ok));
      bind("pickup_result", (m: any) => pushMessage(m?.message ?? "Picked up", ok));
      bind("drop_result", (m: any) => pushMessage(m?.message ?? "Dropped", warn));
      bind("error", (m: any) => pushMessage(m?.message ?? "Error", err));
      bind("auto_navigate_result", (m: any) => pushMessage(m?.message ?? "Path found", ok));
      bind("auto_navigate_step", (m: any) => pushMessage(`Step ${m?.step}/${m?.totalSteps}`, GAME_CONSTANTS.COLORS.DEBUG));
      bind("auto_navigate_complete", () => pushMessage("Arrived at destination", GAME_CONSTANTS.COLORS.SUCCESS));
      bind("auto_navigate_stopped", (m: any) => pushMessage(m?.message ?? "Navigation stopped", GAME_CONSTANTS.COLORS.WARNING));

      // Save/Load
      bind("save_result", (m: any) => pushMessage(m?.message ?? "Game saved", ok));
      bind("load_result", (m: any) => pushMessage(m?.message ?? "Game loaded", ok));

      // Language
      bind("language_data_init", (m: any) => pushMessage(`Language ready: ${m?.totalEntries ?? 0} entries`, GAME_CONSTANTS.COLORS.INFO));
      bind("language_search_results", (m: any) => pushMessage(`Search '${m?.query ?? ''}': ${m?.results?.length ?? 0} hits`, GAME_CONSTANTS.COLORS.LANGUAGE));
      bind("language_entry_result", (m: any) => pushMessage(m?.entry ? `Entry: ${m.entry.word}` : `No entry for ${m?.key}`, GAME_CONSTANTS.COLORS.LANGUAGE));

      // Catch-all to surface any other client.send messages
      const anyHandler = (type: string, msg: any) => {
        // Avoid duplicating types we already explicitly handle
        const known = new Set([
          "combat_result","spacebar_attack_result","spell_result","pickup_result","drop_result","error",
          "auto_navigate_result","auto_navigate_step","auto_navigate_complete","auto_navigate_stopped",
          "save_result","load_result","language_data_init","language_search_results","language_entry_result"
        ]);
        if (!known.has(type)) {
          pushMessage(formatMsg(type, msg), GAME_CONSTANTS.COLORS.INFO);
        }
      };
      room.onMessage("*", anyHandler);
      unsubscribe.push(() => {
        const off = (room as any).removeListener || (room as any).off;
        if (typeof off === "function") {
          try { off.call(room, "*", anyHandler); } catch { /* noop */ }
        }
      });

      // Confirm binding
      pushMessage("HUD subscribed to server messages", GAME_CONSTANTS.COLORS.INFO);
    };

    // If already joined, bind now; otherwise bind after connect
    if ((gameClient as any)["room"]) {
      bindRoomHandlers();
    } else {
      gameClient.onConnect(() => bindRoomHandlers());
    }

    return () => {
      unsubscribe.forEach(fn => fn());
    };
  }, []);

  const styles = useMemo(() => ({
    container: {
      width: `${width}px`,
      height: `${height}px`,
      padding: '10px',
      boxSizing: 'border-box',
      color: '#fff',
      fontFamily: 'Courier New, monospace',
      fontSize: '14px',
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '4px',
    } as CSSProperties,
    title: {
      fontWeight: 700,
      color: '#dddddd',
      marginBottom: '6px',
    } as CSSProperties,
    line: (color?: number) => ({
      color: color ? `#${color.toString(16).padStart(6, '0')}` : '#ffffff',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    } as CSSProperties),
  }), [width, height]);

  const padding = 10;
  const lineHeight = 18;
  const maxVisible = Math.floor((height - padding * 2) / lineHeight);
  const visibleMessages = messages.slice(-maxVisible);

  // Do not render if not connected to a room yet
  const room = (gameClient as any)["room"];
  if (!room) return null;

  return (
    <div style={styles.container}>
      <div style={styles.title}>Messages</div>
      {visibleMessages.map((m) => (
        <div key={m.id} style={styles.line(m.color)}>{m.text}</div>
      ))}
    </div>
  );
};
