/* eslint-disable prettier/prettier */
import { Application, Assets, Container, Sprite, Rectangle } from "pixi.js";
import * as Colyseus from "colyseus.js";

const TILE_SIZE = 32;

// Absolute FS paths via Vite /@fs for dev server access outside project root
const ASSET_PATHS = {
  floor: "/@fs/f:/elemantel/assets/tiles/dc-dngn/floor/rect_gray0.png",
  wall: "/@fs/f:/elemantel/assets/tiles/dc-dngn/wall/brick_gray0.png",
  item: "/@fs/f:/elemantel/assets/tiles/item/weapon/long_sword1.png",
  enemy: "/@fs/f:/elemantel/assets/tiles/dc-mon/orc.png",
  player: "/@fs/f:/elemantel/assets/tiles/player/base/human_m.png",
};

type ClientItem = { name: string; type: string };
type ClientMonster = { x: number; y: number; kind: string };
type ClientTile = { terrain: number; items: ClientItem[]; monsters: ClientMonster[] };
type ClientTileRow = { tiles: ClientTile[] };
type ClientMap = { width: number; height: number; tiles: ClientTileRow[] };
type ClientPlayer = { x: number; y: number; onChange?: (changes?: unknown) => void };

function isClientMap(m: unknown): m is ClientMap {
  if (!m || typeof m !== "object") return false;
  const mm = m as { width?: unknown; height?: unknown; tiles?: unknown };
  const tiles = mm.tiles as unknown as { length?: unknown };
  const hasArrayLikeTiles = tiles && typeof tiles.length === "number";
  return (
    typeof mm.width === "number" &&
    typeof mm.height === "number" &&
    hasArrayLikeTiles
  );
}

(async () => {
  const statusEl = document.getElementById("status")!;
  const joinBtn = document.getElementById("join-btn")! as HTMLButtonElement;
  const messagesEl = document.getElementById("messages")!;
  const inventoryEl = document.getElementById("inventory")!;
  const inventoryListEl = document.getElementById("inventory-list")!;

  // Create and init Pixi
  const app = new Application();
  await app.init({ background: "#000000", resizeTo: window });
  document.getElementById("pixi-container")!.appendChild(app.canvas);

  // Scene graph: camera -> world layers
  const camera = new Container();
  const tileLayer = new Container();
  const overlayLayer = new Container(); // items + enemies
  const playerLayer = new Container();
  camera.addChild(tileLayer);
  camera.addChild(overlayLayer);
  camera.addChild(playerLayer);
  app.stage.addChild(camera);
  app.stage.eventMode = "static";
  app.stage.hitArea = new Rectangle(0, 0, app.screen.width, app.screen.height);

  // Preload required textures
  const [texFloor, texWall, texItem, texEnemy, texPlayer] = await Promise.all([
    Assets.load(ASSET_PATHS.floor),
    Assets.load(ASSET_PATHS.wall),
    Assets.load(ASSET_PATHS.item),
    Assets.load(ASSET_PATHS.enemy),
    Assets.load(ASSET_PATHS.player),
  ]);

  // Entities
  let playerSprite: Sprite | null = null;
  let roomRef: Colyseus.Room | null = null;
  let playerRef: ClientPlayer | null = null;
  let mapRef: ClientMap | null = null;

  function centerCameraOn(x: number, y: number) {
    const targetX = x * TILE_SIZE + TILE_SIZE / 2;
    const targetY = y * TILE_SIZE + TILE_SIZE / 2;
    camera.position.set(
      app.screen.width / 2 - targetX,
      app.screen.height / 2 - targetY
    );
  }

  async function joinGame() {
    try {
      statusEl.textContent = "Connecting...";
      joinBtn.disabled = true;

      const client = new Colyseus.Client("ws://localhost:2567");
      const room = await client.joinOrCreate("my_room");
      roomRef = room;
      statusEl.textContent = "Joined room, loading map...";
      // Listen for server info/log/error messages
      room.onMessage("info", (payload: unknown) => {
        const message = (payload && typeof payload === "object" && "message" in (payload as Record<string, unknown>))
          ? String((payload as { message?: unknown }).message)
          : String(payload);
        const line = document.createElement("div");
        line.textContent = message;
        messagesEl.appendChild(line);
        // Limit to last ~30 messages
        while (messagesEl.childElementCount > 30) messagesEl.removeChild(messagesEl.firstElementChild!);
      });
      room.onMessage("error", (payload: unknown) => {
        const message = (payload && typeof payload === "object" && "message" in (payload as Record<string, unknown>))
          ? String((payload as { message?: unknown }).message)
          : String(payload);
        const line = document.createElement("div");
        line.textContent = `Error: ${message}`;
        messagesEl.appendChild(line);
      });
            room.onMessage("pickup_result", (payload: { message?: string; item?: string } | unknown) => {
              const line = document.createElement("div");
              const msg = (payload && typeof payload === "object" && "message" in (payload as Record<string, unknown>))
                ? String((payload as { message?: unknown }).message)
                : "Picked up";
              line.textContent = msg;
              messagesEl.appendChild(line);
            });
            room.onMessage("drop_result", (payload: { message?: string; item?: string } | unknown) => {
              const line = document.createElement("div");
              const msg = (payload && typeof payload === "object" && "message" in (payload as Record<string, unknown>))
                ? String((payload as { message?: unknown }).message)
                : "Dropped";
              line.textContent = msg;
              messagesEl.appendChild(line);
            });
      room.onMessage("log", (payload: unknown) => {
        const message = (payload && typeof payload === "object" && "message" in (payload as Record<string, unknown>))
          ? String((payload as { message?: unknown }).message)
          : String(payload);
        const line = document.createElement("div");
        line.textContent = `Log: ${message}`;
        messagesEl.appendChild(line);
      });
      // Auto-navigate feedback
      room.onMessage("auto_navigate_result", (payload: unknown) => {
        const line = document.createElement("div");
        const msg = (payload && typeof payload === "object" && "message" in (payload as Record<string, unknown>))
          ? String((payload as { message?: unknown }).message)
          : "Path result";
        line.textContent = msg;
        messagesEl.appendChild(line);
      });
      room.onMessage("auto_navigate_step", (payload: unknown) => {
        const line = document.createElement("div");
        const step = (payload && typeof payload === "object" && "step" in (payload as Record<string, unknown>))
          ? String((payload as { step?: unknown }).step)
          : "?";
        const total = (payload && typeof payload === "object" && "totalSteps" in (payload as Record<string, unknown>))
          ? String((payload as { totalSteps?: unknown }).totalSteps)
          : "?";
        line.textContent = `Step ${step}/${total}`;
        messagesEl.appendChild(line);
      });
      room.onMessage("auto_navigate_stopped", (payload: unknown) => {
        const line = document.createElement("div");
        const msg = (payload && typeof payload === "object" && "message" in (payload as Record<string, unknown>))
          ? String((payload as { message?: unknown }).message)
          : "Path stopped";
        line.textContent = msg;
        messagesEl.appendChild(line);
      });
      room.onMessage("auto_navigate_complete", (payload: unknown) => {
        const line = document.createElement("div");
        const msg = (payload && typeof payload === "object" && "message" in (payload as Record<string, unknown>))
          ? String((payload as { message?: unknown }).message)
          : "Path complete";
        line.textContent = msg;
        messagesEl.appendChild(line);
      });

      // Render terrain once; update overlays and player every patch
      let initialized = false;
      room.onStateChange((st) => {
        const state = st as unknown as { map: unknown; player: ClientPlayer };
        if (!isClientMap(state.map)) {
          // Wait for next patch if map not ready yet
          statusEl.textContent = "Waiting for map...";
          return;
        }
        const map = state.map;
        mapRef = map;
        const width: number = map.width;
        const height: number = map.height;
        if (!initialized) {
          tileLayer.removeChildren();
          for (let y = 0; y < height; y++) {
            const row = map.tiles[y];
            for (let x = 0; x < width; x++) {
              const tile = row.tiles[x];
              const terrain: number = tile.terrain;
              const isFloor = terrain === 0;
              const s = new Sprite(isFloor ? texFloor : texWall);
              s.x = x * TILE_SIZE;
              s.y = y * TILE_SIZE;
              tileLayer.addChild(s);
            }
          }

          const player = state.player;
          playerRef = player;
          playerSprite = new Sprite(texPlayer);
          playerSprite.x = player.x * TILE_SIZE;
          playerSprite.y = player.y * TILE_SIZE;
          playerLayer.addChild(playerSprite);
          centerCameraOn(player.x, player.y);

          initialized = true;
          statusEl.textContent = "Map loaded";
        }

        // Refresh overlays each patch
        overlayLayer.removeChildren();
        for (let y = 0; y < height; y++) {
          const row = map.tiles[y];
          for (let x = 0; x < width; x++) {
            const tile = row.tiles[x];
            const px = x * TILE_SIZE;
            const py = y * TILE_SIZE;
            if (tile.items && (tile.items.length as number) > 0) {
              const itemSprite = new Sprite(texItem);
              itemSprite.x = px;
              itemSprite.y = py;
              overlayLayer.addChild(itemSprite);
            }
            if (tile.monsters && (tile.monsters.length as number) > 0) {
              const enemySprite = new Sprite(texEnemy);
              enemySprite.x = px;
              enemySprite.y = py;
              overlayLayer.addChild(enemySprite);
            }
          }
        }

        // Update player position on each patch
        const player = state.player;
        if (playerSprite) {
          playerSprite.x = player.x * TILE_SIZE;
          playerSprite.y = player.y * TILE_SIZE;
          centerCameraOn(player.x, player.y);
        }
      });
    } catch (err) {
      // Report detailed error info for easier debugging
      const msg = err && typeof err === "object" && "message" in (err as Record<string, unknown>)
        ? String((err as { message?: unknown }).message)
        : String(err);
      console.error("Join/render error:", err);
      statusEl.textContent = `Failed to join: ${msg}`;
      joinBtn.disabled = false;
    }
  }

  function sendMove(dx: number, dy: number, attack = false) {
    if (!roomRef) return;
    try {
      roomRef.send("move", attack ? { dx: 0, dy: 0, attack: true } : { dx, dy });
    } catch (e) {
      const line = document.createElement("div");
      line.textContent = `Move send failed: ${String(e)}`;
      messagesEl.appendChild(line);
    }
  }

  // Keyboard controls
  window.addEventListener("keydown", (ev) => {
    const key = ev.key.toLowerCase();
    let dx = 0, dy = 0;
    let handled = true;
    if (key === "arrowup" || key === "w") dy = -1; else
    if (key === "arrowdown" || key === "s") dy = 1; else
    if (key === "arrowleft" || key === "a") dx = -1; else
    if (key === "arrowright" || key === "d") dx = 1; else
    if (key === " ") { sendMove(0, 0, true); ev.preventDefault(); return; } else handled = false;
    if (handled) {
      ev.preventDefault();
      if (dx !== 0 || dy !== 0) sendMove(dx, dy);
    }
  });

  // Pickup (E) and Drop (G)
  window.addEventListener("keydown", (ev) => {
    const key = ev.key.toLowerCase();
    if (!roomRef) return;
    if (key === "i") {
      ev.preventDefault();
      // Toggle inventory panel and refresh list
      const isHidden = inventoryEl.classList.contains("hidden");
      if (isHidden) inventoryEl.classList.remove("hidden"); else inventoryEl.classList.add("hidden");
      // Refresh list
      inventoryListEl.textContent = "";
      const items = (playerRef as unknown as { inventory?: { length: number; [index: number]: string } })?.inventory;
      const count = items?.length ?? 0;
      for (let i = 0; i < count; i++) {
        const li = document.createElement("li");
        li.textContent = String(items![i]);
        inventoryListEl.appendChild(li);
      }
    } else if (key === "e") {
      ev.preventDefault();
      // Equip last item to main hand (simple default)
      const items = (playerRef as unknown as { inventory?: { length: number; [index: number]: string } })?.inventory;
      const count = items?.length ?? 0;
      if (count > 0) {
        const itemName = items![count - 1];
        roomRef.send("equip", { slotPath: "hand_slots.main_hand", itemName });
      } else {
        const line = document.createElement("div");
        line.textContent = "No items to equip";
        messagesEl.appendChild(line);
      }
    } else if (key === "g") {
      ev.preventDefault();
      // Drop last item in inventory if available
      const items = (playerRef as unknown as { inventory?: { length: number; [index: number]: string } })?.inventory;
      const count = items?.length ?? 0;
      if (count > 0) {
        const itemName = items![count - 1];
        roomRef.send("drop_item", { itemName });
      } else {
        const line = document.createElement("div");
        line.textContent = "No items to drop";
        messagesEl.appendChild(line);
      }
    }
  });

  // Click to travel/attack
  app.stage.on("pointerdown", (ev: { globalX: number; globalY: number }) => {
    if (!roomRef || !mapRef || !playerRef) return;
    const gx = ev.globalX;
    const gy = ev.globalY;
    const worldX = gx - camera.x;
    const worldY = gy - camera.y;
    const tx = Math.floor(worldX / TILE_SIZE);
    const ty = Math.floor(worldY / TILE_SIZE);
    if (tx < 0 || ty < 0 || tx >= mapRef.width || ty >= mapRef.height) return;
    const tile = mapRef.tiles[ty].tiles[tx];
    const hasEnemy = tile.monsters && (tile.monsters.length as number) > 0;
    const dist = Math.abs(playerRef.x - tx) + Math.abs(playerRef.y - ty);
    if (hasEnemy && dist === 1) {
      roomRef.send("attack", { targetX: tx, targetY: ty });
      return;
    }
    const isFloor = tile.terrain === 0;
    if (isFloor) {
      roomRef.send("auto_navigate", { targetX: tx, targetY: ty, moveInterval: 100 });
    }
  });

  joinBtn.addEventListener("click", joinGame);
})();
