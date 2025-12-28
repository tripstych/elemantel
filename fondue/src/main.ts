/* eslint-disable prettier/prettier */
import { Application, Assets, Container, Sprite } from "pixi.js";
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

  // Create and init Pixi
  const app = new Application();
  await app.init({ background: "#000000", resizeTo: window });
  document.getElementById("pixi-container")!.appendChild(app.canvas);

  // Scene graph: camera -> world layers
  const camera = new Container();
  const tileLayer = new Container();
  const entityLayer = new Container();
  camera.addChild(tileLayer);
  camera.addChild(entityLayer);
  app.stage.addChild(camera);

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
      statusEl.textContent = "Joined room, loading map...";

      // Render once the first state patch arrives
      let rendered = false;
      room.onStateChange((st) => {
        if (rendered) return;
        const state = st as unknown as { map: unknown; player: ClientPlayer };
        if (!isClientMap(state.map)) {
          // Wait for next patch if map not ready yet
          statusEl.textContent = "Waiting for map...";
          return;
        }
        const map = state.map;
        const width: number = map.width;
        const height: number = map.height;

        tileLayer.removeChildren();
        entityLayer.removeChildren();

        for (let y = 0; y < height; y++) {
          const row = map.tiles[y];
          for (let x = 0; x < width; x++) {
            const tile = row.tiles[x];
            const terrain: number = tile.terrain;
            const isFloor = terrain === 0; // 0=floor, else treat as wall for now
            const s = new Sprite(isFloor ? texFloor : texWall);
            s.x = x * TILE_SIZE;
            s.y = y * TILE_SIZE;
            tileLayer.addChild(s);

            // Items
            if (tile.items && (tile.items.length as number) > 0) {
              const itemSprite = new Sprite(texItem);
              itemSprite.x = s.x;
              itemSprite.y = s.y;
              entityLayer.addChild(itemSprite);
            }

            // Enemies
            if (tile.monsters && (tile.monsters.length as number) > 0) {
              const enemySprite = new Sprite(texEnemy);
              enemySprite.x = s.x;
              enemySprite.y = s.y;
              entityLayer.addChild(enemySprite);
            }
          }
        }

        // Player
        const player = state.player;
        playerSprite = new Sprite(texPlayer);
        playerSprite.x = player.x * TILE_SIZE;
        playerSprite.y = player.y * TILE_SIZE;
        entityLayer.addChild(playerSprite);
        centerCameraOn(player.x, player.y);

        // Keep camera centered on player when position changes
        player.onChange = () => {
          if (!playerSprite) return;
          playerSprite!.x = player.x * TILE_SIZE;
          playerSprite!.y = player.y * TILE_SIZE;
          centerCameraOn(player.x, player.y);
        };

        rendered = true;
        statusEl.textContent = "Map loaded";
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

  joinBtn.addEventListener("click", joinGame);
})();
