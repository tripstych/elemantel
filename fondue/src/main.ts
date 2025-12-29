/* eslint-disable prettier/prettier */
import { Application, Assets, Container, Sprite, Rectangle } from "pixi.js";
import * as Colyseus from "colyseus.js";
import { GAME_CONSTANTS } from "../../shared/constants";

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
    // Enable drop-to-unequip on the inventory list
    inventoryListEl.addEventListener("dragover", (ev) => {
      ev.preventDefault();
      inventoryListEl.classList.add("drag-over");
    });
    inventoryListEl.addEventListener("dragleave", () => {
      inventoryListEl.classList.remove("drag-over");
    });
    inventoryListEl.addEventListener("drop", (ev) => {
      ev.preventDefault();
      inventoryListEl.classList.remove("drag-over");
      const slotPath = ev.dataTransfer?.getData("text/slot-path");
      if (slotPath && roomRef) {
        roomRef.send("unequip", { slotPath });
      }
    });
  const equipMainEl = document.getElementById("equip-main")!;
  const equipOffEl = document.getElementById("equip-off")!;
  const equipGridEl = document.getElementById("equip-grid")!;
  const equipSlotEl = document.getElementById("equip-slot")! as HTMLSelectElement;
  const equipBtnEl = document.getElementById("btn-equip")! as HTMLButtonElement;

  // Populate slot selector from shared constants (hands + body)
  function populateEquipSlots() {
    equipSlotEl.innerHTML = "";
    const handSlots = GAME_CONSTANTS.EQUIPMENT_SLOTS.HAND;
    const bodySlots = GAME_CONSTANTS.EQUIPMENT_SLOTS.BODY;
    // Use slots from shared constants (already referenced in section builders)
    for (const s of handSlots) {
      const opt = document.createElement("option");
      opt.value = `hand_slots.${s}`;
      opt.textContent = s;
      equipSlotEl.appendChild(opt);
    }
    for (const s of bodySlots) {
      const opt = document.createElement("option");
      opt.value = `body_slots.${s}`;
      opt.textContent = s;
      equipSlotEl.appendChild(opt);
    }
  }
  populateEquipSlots();

  // Icon mapping for slots using repo assets
  const SLOT_ICONS: Record<string, string> = {
    // Right hand (main)
    "hand_slots.main_hand": "/@fs/f:/elemantel/assets/tiles/item/weapon/long_sword1.png",
    // Left hand (off)
    "hand_slots.off_hand": "/@fs/f:/elemantel/assets/tiles/item/armour/shields/shield2_kite.png",
    "body_slots.head": "/@fs/f:/elemantel/assets/tiles/item/armour/headgear/helmet1_visored.png",
    "body_slots.face": "/@fs/f:/elemantel/assets/tiles/item/armour/headgear/helmet2_etched.png",
    "body_slots.neck": "/@fs/f:/elemantel/assets/tiles/item/amulet/celtic_blue.png",
    "body_slots.torso": "/@fs/f:/elemantel/assets/tiles/item/armour/plate_mail1.png",
    "body_slots.back": "/@fs/f:/elemantel/assets/tiles/item/armour/cloak1_leather.png",
    "body_slots.waist": "/@fs/f:/elemantel/assets/tiles/item/armour/robe1.png",
    "body_slots.wrists": "/@fs/f:/elemantel/assets/tiles/item/armour/glove1.png",
    "body_slots.left_finger": "/@fs/f:/elemantel/assets/tiles/item/ring/gold.png",
    "body_slots.right_finger": "/@fs/f:/elemantel/assets/tiles/item/ring/silver.png",
    "body_slots.legs": "/@fs/f:/elemantel/assets/tiles/item/armour/scale_mail1.png",
    "body_slots.feet": "/@fs/f:/elemantel/assets/tiles/item/armour/boots1_brown.png",
  };

  // Try to derive an item icon from its name
  function getItemIcon(name: string): string {
    const n = name.toLowerCase();
    if (n.includes("ring")) return "/@fs/f:/elemantel/assets/tiles/item/ring/gold.png";
    if (n.includes("amulet") || n.includes("neck")) return "/@fs/f:/elemantel/assets/tiles/item/amulet/celtic_blue.png";
    if (n.includes("helm") || n.includes("helmet")) return "/@fs/f:/elemantel/assets/tiles/item/armour/headgear/helmet1_visored.png";
    if (n.includes("cloak")) return "/@fs/f:/elemantel/assets/tiles/item/armour/cloak1_leather.png";
    if (n.includes("boot")) return "/@fs/f:/elemantel/assets/tiles/item/armour/boots1_brown.png";
    if (n.includes("glove") || n.includes("gauntlet")) return "/@fs/f:/elemantel/assets/tiles/item/armour/glove1.png";
    if (n.includes("sword") || n.includes("axe") || n.includes("mace") || n.includes("dagger")) return "/@fs/f:/elemantel/assets/tiles/item/weapon/long_sword1.png";
    if (n.includes("shield")) return "/@fs/f:/elemantel/assets/tiles/item/armour/shields/shield2_kite.png";
    if (n.includes("armor") || n.includes("armour") || n.includes("mail") || n.includes("robe") || n.includes("plate")) return "/@fs/f:/elemantel/assets/tiles/item/armour/plate_mail1.png";
    return "/@fs/f:/elemantel/assets/tiles/item/misc/misc_box.png";
  }

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
  let selectedItemName: string | null = null;

  function centerCameraOn(x: number, y: number) {
    const targetX = x * TILE_SIZE + TILE_SIZE / 2;
    const targetY = y * TILE_SIZE + TILE_SIZE / 2;
    camera.position.set(
      app.screen.width / 2 - targetX,
      app.screen.height / 2 - targetY
    );
  }

  let inventoryRefreshPending = false;
  function markInventoryDirty() {
    inventoryRefreshPending = true;
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
              markInventoryDirty();
            });
            room.onMessage("drop_result", (payload: { message?: string; item?: string } | unknown) => {
              const line = document.createElement("div");
              const msg = (payload && typeof payload === "object" && "message" in (payload as Record<string, unknown>))
                ? String((payload as { message?: unknown }).message)
                : "Dropped";
              line.textContent = msg;
              messagesEl.appendChild(line);
            });
            room.onMessage("equip_result", () => {
              markInventoryDirty();
            });
            room.onMessage("unequip_result", () => {
              markInventoryDirty();
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

        // Refresh inventory once when flagged and a state patch has arrived
        if (inventoryRefreshPending && !inventoryEl.classList.contains("hidden")) {
          refreshInventoryUI();
          inventoryRefreshPending = false;
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

  // Inventory toggle (I), Equip (E), Pickup (G)
  window.addEventListener("keydown", (ev) => {
    const key = ev.key.toLowerCase();
    if (!roomRef) return;
    if (key === "i") {
      ev.preventDefault();
      // Toggle inventory panel and refresh list
      const isHidden = inventoryEl.classList.contains("hidden");
      if (isHidden) inventoryEl.classList.remove("hidden"); else inventoryEl.classList.add("hidden");
      if (isHidden) {
        refreshInventoryUI();
        inventoryRefreshPending = false;
      } else if (inventoryRefreshPending) {
        refreshInventoryUI();
        inventoryRefreshPending = false;
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
      // Pick up item(s) on current tile
      roomRef.send("pickup", {});
    }
  });

  function refreshInventoryUI() {
    // List inventory
    inventoryListEl.textContent = "";
    selectedItemName = null;
    const items = (playerRef as unknown as { inventory?: { length: number; [index: number]: string } })?.inventory;
    const count = items?.length ?? 0;
    for (let i = 0; i < count; i++) {
      const name = String(items![i]);
      const li = document.createElement("li");
      const icon = document.createElement("img");
      icon.className = "item-icon";
      icon.src = getItemIcon(name);
      const label = document.createElement("span");
      label.textContent = name;
      li.appendChild(icon);
      li.appendChild(label);
      li.draggable = true;
      li.addEventListener("dragstart", (ev) => {
        ev.dataTransfer?.setData("text/item-name", name);
        ev.dataTransfer!.effectAllowed = "copy";
      });
      li.addEventListener("click", () => {
        selectedItemName = name;
        // mark selected
        Array.from(inventoryListEl.children).forEach((child) => child.classList.remove("selected"));
        li.classList.add("selected");
      });
      inventoryListEl.appendChild(li);
    }

    // Show equipped (try both equipment and slots structures)
    type EquipStructFull = {
      hand_slots?: { main_hand?: string; off_hand?: string };
      body_slots?: Record<string, string | undefined>;
    };
    const pEquip = (playerRef as unknown as { equipment?: EquipStructFull; slots?: EquipStructFull });
    const main = pEquip?.slots?.hand_slots?.main_hand ?? pEquip?.equipment?.hand_slots?.main_hand ?? "(empty)";
    const off = pEquip?.slots?.hand_slots?.off_hand ?? pEquip?.equipment?.hand_slots?.off_hand ?? "(empty)";
    equipMainEl.textContent = String(main || "(empty)");
    equipOffEl.textContent = String(off || "(empty)");

    // Equipment grid rows per pseudocode
    const makeVal = (path: string, key: string) => {
      const v = path.startsWith("hand_slots")
        ? (pEquip?.slots?.hand_slots?.[key as "main_hand"|"off_hand"] ?? pEquip?.equipment?.hand_slots?.[key as "main_hand"|"off_hand"]) 
        : (pEquip?.slots?.body_slots?.[key] ?? pEquip?.equipment?.body_slots?.[key]);
      return String(v || "(empty)");
    };
    equipGridEl.textContent = "";

    function makeSlot(label: string, path: string, key: string) {
      const value = makeVal(path, key);
      const el = document.createElement("div");
      el.className = `equip-slot ${value === "(empty)" ? "empty" : ""}`;
      el.dataset.path = path;
      const iconEl = document.createElement("img");
      iconEl.className = "icon";
      const iconPath = value !== "(empty)" ? getItemIcon(value) : SLOT_ICONS[path];
      if (iconPath) iconEl.src = iconPath;
      el.appendChild(iconEl);
      // Tooltip with slot/value info
      el.title = `${label}: ${value}`;
      // Click-to-equip
      el.addEventListener("click", () => {
        if (!roomRef) return;
        if (!selectedItemName) {
          const line = document.createElement("div");
          line.textContent = "Select an item, then click a slot";
          messagesEl.appendChild(line);
          return;
        }
        roomRef.send("equip", { slotPath: path, itemName: selectedItemName });
      });
      // Drag-over to equip
      el.addEventListener("dragover", (ev) => {
        ev.preventDefault();
        el.classList.add("drag-over");
      });
      el.addEventListener("dragleave", () => {
        el.classList.remove("drag-over");
      });
      el.addEventListener("drop", (ev) => {
        ev.preventDefault();
        el.classList.remove("drag-over");
        const itemName = ev.dataTransfer?.getData("text/item-name");
        if (itemName && roomRef) {
          roomRef.send("equip", { slotPath: path, itemName });
        }
      });
      // Drag-from slot to unequip (when not empty)
      if (value && value !== "(empty)") {
        el.draggable = true;
        el.addEventListener("dragstart", (ev) => {
          ev.dataTransfer?.setData("text/slot-path", path);
          ev.dataTransfer!.effectAllowed = "move";
        });
      }
      return el;
    }

    // Row 1: center Head
    const row1 = document.createElement("div");
    row1.className = "equip-row";
    const r1c1 = document.createElement("div");
    const r1c2 = document.createElement("div"); r1c2.className = "center"; r1c2.appendChild(makeSlot("Head", "body_slots.head", "head"));
    const r1c3 = document.createElement("div");
    row1.appendChild(r1c1); row1.appendChild(r1c2); row1.appendChild(r1c3);
    equipGridEl.appendChild(row1);

    // Row 2: left Arm (Left Hand), center Torso, right Arm (Right Hand)
    const row2 = document.createElement("div");
    row2.className = "equip-row";
    const r2c1 = document.createElement("div"); r2c1.className = "left"; r2c1.appendChild(makeSlot("Left Hand", "hand_slots.off_hand", "off_hand"));
    const r2c2 = document.createElement("div"); r2c2.className = "center"; r2c2.appendChild(makeSlot("Torso", "body_slots.torso", "torso"));
    const r2c3 = document.createElement("div"); r2c3.className = "right"; r2c3.appendChild(makeSlot("Right Hand", "hand_slots.main_hand", "main_hand"));
    row2.appendChild(r2c1); row2.appendChild(r2c2); row2.appendChild(r2c3);
    equipGridEl.appendChild(row2);

    // Row 3: left leg, center spacer, right leg (both map to same 'legs' slot)
    const row3 = document.createElement("div");
    row3.className = "equip-row";
    const r3c1 = document.createElement("div"); r3c1.className = "left"; r3c1.appendChild(makeSlot("Left Leg", "body_slots.legs", "legs"));
    const r3c2 = document.createElement("div"); r3c2.className = "center";
    const r3c3 = document.createElement("div"); r3c3.className = "right"; r3c3.appendChild(makeSlot("Right Leg", "body_slots.legs", "legs"));
    row3.appendChild(r3c1); row3.appendChild(r3c2); row3.appendChild(r3c3);
    equipGridEl.appendChild(row3);

    // Row 4: left foot, center little spacer, right foot (both map to same 'feet' slot)
    const row4 = document.createElement("div");
    row4.className = "equip-row";
    const r4c1 = document.createElement("div"); r4c1.className = "left"; r4c1.appendChild(makeSlot("Left Foot", "body_slots.feet", "feet"));
    const r4c2 = document.createElement("div"); r4c2.className = "center";
    const r4c3 = document.createElement("div"); r4c3.className = "right"; r4c3.appendChild(makeSlot("Right Foot", "body_slots.feet", "feet"));
    row4.appendChild(r4c1); row4.appendChild(r4c2); row4.appendChild(r4c3);
    equipGridEl.appendChild(row4);
  }

  // Equip button
  equipBtnEl.addEventListener("click", () => {
    if (!roomRef) return;
    if (!selectedItemName) {
      const line = document.createElement("div");
      line.textContent = "Select an item to equip";
      messagesEl.appendChild(line);
      return;
    }
    const slotPath = equipSlotEl.value;
    roomRef.send("equip", { slotPath, itemName: selectedItemName });
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
  
  
  // setTimeout(() => { joinGame();},300);
})();
