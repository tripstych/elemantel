import { Room, Client } from "@colyseus/core";
import { ClientMessages } from "../utils/ClientSend";
import { PlayerCommands } from "../commands/PlayerCommands";
import { MyRoomState, PlayerSchema } from "./schema/MyRoomState";
import { PlayerState } from "../schema/PlayerState";
import { WorldItem } from "../schema/Item";
import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";
import { CombatCommand, CombatLog } from "../commands/CombatCommand";
import { Weapon } from "../schema/Equipment";
import { ItemData } from "../schema/ItemData";
import { WorldGenerationCommand } from "../commands/WorldGenerationCommand";
import { LanguageData } from "../schema/LanguageData";
import { DataService } from "../services/DataService";
import { GAME_CONSTANTS } from "../../../shared/constants";
import { Tile, TileRow } from "../schema/GameMap";
import { MonsterState } from "../schema/MonsterState";
import * as path from "path";
import * as fsp from "fs/promises";
import { Encoder } from "@colyseus/schema";

// Increase buffer size for large language data
Encoder.BUFFER_SIZE = 64 * 1024; // 64 KB

// Use the shared schema `LanguageData` and preload via DataService
const shouldLog = !(typeof process !== "undefined" && process.env && process.env.NODE_ENV === "test");

/* why the fuck was this not here */
const walkableTiles = new Set([0, 3, 4, 5, 6]); // floor, corridor, room_floor, entrance, exit



export class MyRoom extends Room<MyRoomState> {
  maxClients = 4;
  // state will be initialized via setState() during onCreate
  private gameData: any = {};
  private languageData: LanguageData = new LanguageData();
  private itemData: ItemData = new ItemData();
  private playerPaths: Map<string, { path: Array<{x: number, y: number}>, currentIndex: number, moveInterval: NodeJS.Timeout | null }> = new Map();
  private playerMoveTimes: Map<string, number> = new Map();
  private dataService: DataService | null = null;
  private playerClient: Client | null = null;
  private weaponDamageMap: Map<string, number> = new Map();
  private armorDefenseMap: Map<string, number> = new Map();
  private deepPlain(obj: any): any {
    if (!obj || typeof obj !== 'object') { return obj; }
    const out: any = Array.isArray(obj) ? [] : {};
    for (const k of Object.keys(obj)) {
      if (k === 'constructor' || k.startsWith('~')) continue;
      out[k] = this.deepPlain(obj[k]);
    }
    return out;
  }

  async onCreate (options: any) {
    if (shouldLog) console.log("Creating room with full main.py functionality");

    // Delay setState until after initial world generation

    // Initialize data service and preload datasets
    this.dataService = options?.dataService || new DataService();
    console.log('MY ROOM onCreate');
    this.dataService.ensureLoaded();
    console.log('ENSURE LOADED CALLED');
    const { elementalDarkAlphabet, elementalDictionary, elementalLightAlphabet, itemTypes } = this.dataService.getData();

    // console.log(Object.keys(elementalDictionary).length,'DICTIONARY ENTRIES');

    this.gameData = { elementalDarkAlphabet, elementalDictionary, elementalLightAlphabet };
    this.itemData.elementalDictionary = elementalDictionary;
    // Build LanguageData entries from dictionary for reliable lookups
    const ld = this.dataService.createLanguageData();
    if (ld) {
      this.languageData = ld;
    }

    // if (shouldLog) console.log(`Loaded ${this.languageData.entries.size} language entries`);

    if (shouldLog) console.log("Game data loaded:", Object.keys(this.gameData));

    // Initialize synchronized state
    // this.setState(new MyRoomState());
    this.state = (new MyRoomState());

    // Preload item power scales
    await this.loadItemScales();

    // Get dungeon generation options
    const width = options.width || 60;
    const height = options.height || 30;
    const algorithm = options.algorithm || 'rooms_corridors'; // 'bsp', 'cellular', 'drunkard', 'rooms_corridors'

    // Generate dungeon using specified algorithm
    this.generateDungeon(width, height, algorithm);

    // Add player stats
    this.initializePlayerStats();

    // Add starter items
    this.addStarterItems();

    // Scatter items throughout the world (like main.py)
    this.scatterItems();

    // Spawn monsters
    this.spawnMonsters();

    if (shouldLog) console.log("Room ready with full functionality");

    // Start monster AI loop
    this.startMonsterAI();

    this.onMessage("move", (client, message) => {
      const player = this.state.player; // Fixed: player is stored directly, not in players Map
      if (!player) return;

      const dx = message.dx || 0;
      const dy = message.dy || 0;
      
      // Check for spacebar attack (dx=0, dy=0 with attack flag)
      if (message.attack && dx === 0 && dy === 0) {
        this.handleSpacebarAttack(client, player);
        return;
      }
      
      // Calculate movement interval based on inventory weight
      const strength = player.strength || 32;
      const maxCarryWeight = strength * 2000; // grams; 1-64 scale strength gives ~2kg per point
      const currentWeight = player.inventory?.length || 0;
      let moveInterval = 100; // Base interval

      if (currentWeight > maxCarryWeight) {
        const excessWeight = currentWeight - maxCarryWeight;
        const penalty = excessWeight * 15; // 15ms per kg over limit
        moveInterval += penalty;
        console.log(`[DEBUG] Backend - Overweight by ${excessWeight} units, adding ${penalty}ms penalty`);
      }
      
      console.log(`[DEBUG] Backend - Final movement interval: ${moveInterval}ms`);
      
      // Check if movement is on cooldown
      const now = Date.now();
      const lastMoveTime = this.playerMoveTimes.get(client.sessionId) || 0;
      if (now - lastMoveTime < moveInterval) {
        console.log(`[DEBUG] Backend - Movement on cooldown, ${moveInterval - (now - lastMoveTime)}ms remaining`);
        return; // Ignore movement if still on cooldown
      }
      
      const newX = player.x + dx;
      const newY = player.y + dy;
      
      // Boundary check
      if (newX >= 0 && newX < this.state.map.width && 
          newY >= 0 && newY < this.state.map.height) {
        // Check if tile is walkable (0 = floor) using new tile structure
        const tile = this.state.map.tiles[newY].tiles[newX];
        if (tile && tile.terrain === 0) {
          
          // Check for collision with monsters
          if (tile.monsters.length > 0) {
            const monster = tile.monsters[0];
            console.log(`[DEBUG] Backend - Collision with monster ${monster.name} at (${newX}, ${newY})`);
            // Stop player movement - don't allow moving into monster
            return;
          }
          player.x = newX;
          player.y = newY;
          this.playerMoveTimes.set(client.sessionId, now);
          console.log(`[DEBUG] Backend - Player moved to (${newX}, ${newY})`);
          console.log(`${player.name} moved to (${newX}, ${newY})`);

          // Broadcast movement info to the player
          const direction = PlayerCommands.getDirectionName(dx, dy);
          const msg = direction !== "unknown"
            ? `You move ${direction}.`
            : `You move to (${newX}, ${newY}).`;
          ClientMessages.info(client, msg);
        }
      }
    });

    this.onMessage("attack", (client, message) => {
      this.handleAttack(client, message);
    });

    this.onMessage("cast_spell", (client, message) => {
      this.handleSpellCast(client, message);
    });

    this.onMessage("pickup", (client, message) => {
      this.handlePickup(client, message);
    });

    this.onMessage("drop_item", (client, message) => {
      this.handleDropItem(client, message);
    });

    this.onMessage("equip", (client, message) => {
      this.handleEquip(client, message);
    });

    this.onMessage("unequip", (client, message) => {
      this.handleUnequip(client, message);
    });

    // Language data handlers
    this.onMessage("get_language_data", (client, message) => {
      client.send("language_data_init", {
        entries: this.languageData.entries,
        totalEntries: this.languageData.entries.size
      });
    });

    this.onMessage("search_language", (client, message) => {
      const query = message.query || "";
      const results = this.languageData.searchEntries(query);
      client.send("language_search_results", { query, results });
    });

    this.onMessage("save_game", async (client, message) => {
      const player = this.state.player;
      if (!player) return;

      // Create save data
      const saveData = {
        player: {
          x: player.x,
          y: player.y,
          name: player.name,
          inventory: Array.from(player.inventory),
          health: player.health,
          maxHealth: player.maxHealth,
          strength: player.strength,
          equipment: {
            hand_slots: {
              main_hand: player.equipment.hand_slots.main_hand,
              off_hand: player.equipment.hand_slots.off_hand
            },
            body_slots: {
              head: player.equipment.body_slots.head,
              face: player.equipment.body_slots.face,
              neck: player.equipment.body_slots.neck,
              torso: player.equipment.body_slots.torso,
              back: player.equipment.body_slots.back,
              waist: player.equipment.body_slots.waist,
              wrists: player.equipment.body_slots.wrists,
              left_finger: player.equipment.body_slots.left_finger,
              right_finger: player.equipment.body_slots.right_finger,
              legs: player.equipment.body_slots.legs,
              feet: player.equipment.body_slots.feet
            }
          }
        },
        world: Array.from(this.state.world.entries()),
        timestamp: new Date().toISOString()
      };

      // Save to file
      try {
        const savePath = this.dataService ? this.dataService.getSavePath() : path.join(path.resolve(__dirname, '../../..'), 'data', 'save.json');
        await fsp.writeFile(savePath, JSON.stringify(saveData, null, 2), 'utf8');
        console.log('Game saved successfully');
        client.send("save_result", { success: true, message: "Game saved!" });
      } catch (error) {
        console.error('Failed to save game:', error);
        client.send("save_result", { success: false, message: "Failed to save game" });
      }
    });

    this.onMessage("load_game", async (client, message) => {
      try {
        const savePath = this.dataService ? this.dataService.getSavePath() : path.join(path.resolve(__dirname, '../../..'), 'data', 'save.json');
        
        try {
          await fsp.access(savePath);
        } catch {
          client.send("load_result", { success: false, message: "No save file found" });
          return;
        }

        const saveBuf = await fsp.readFile(savePath, 'utf8');
        const saveData = JSON.parse(saveBuf);
        
        // Restore player state
        const player = this.state.player;
        if (player && saveData.player) {
          player.x = saveData.player.x;
          player.y = saveData.player.y;
          player.name = saveData.player.name;
          player.health = saveData.player.health;
          player.maxHealth = saveData.player.maxHealth;
          player.strength = saveData.player.strength;
          
          // Clear and restore inventory
          player.inventory.clear();
          saveData.player.inventory.forEach((item: string) => {
            player.inventory.push(item);
          });
          
          // Restore equipment
          if (saveData.player.equipment) {
            player.equipment.hand_slots.main_hand = saveData.player.equipment.hand_slots.main_hand;
            player.equipment.hand_slots.off_hand = saveData.player.equipment.hand_slots.off_hand;
            
            Object.keys(saveData.player.equipment.body_slots).forEach((slot) => {
              (player.equipment.body_slots as any)[slot] = saveData.player.equipment.body_slots[slot];
            });
          }

          // Refresh derived stats from equipment after load
          this.recalculateDefenseFromEquipment();
        }
        
        // Restore world state
        if (saveData.world) {
          this.state.world.clear();
          saveData.world.forEach(([key, item]: [string, any]) => {
            this.state.world.set(key, item);
          });
        }
        
        console.log('Game loaded successfully');
        client.send("load_result", { success: true, message: "Game loaded!" });
      } catch (error) {
        console.error('Failed to load game:', error);
        client.send("load_result", { success: false, message: "Failed to load game" });
      }
    });

    this.onMessage("get_language_entry", (client, message) => {
      const key = message.key;
      console.log(`Looking for language entry: ${key}`);
      
      // Prefer LanguageData (Schema built from dictionary)
      const languageEntry = this.languageData.getEntry(key);
      if (languageEntry) {
        console.log(`Found entry in LanguageData: ${languageEntry.word}`);
        const plain = (languageEntry as any)?.toJSON ? (languageEntry as any).toJSON() : this.deepPlain(languageEntry);
        client.send("language_entry_result", { key, entry: plain });
        return;
      }
      
      // Final fallback: raw dictionary (plain JSON)
      const raw = this.gameData.elementalDictionary ? this.gameData.elementalDictionary[key] : undefined;
      if (raw) {
        client.send("language_entry_result", { key, entry: raw });
        return;
      }
      
      // Not found in either
      console.log(`Entry not found: ${key}`);
      client.send("language_entry_result", { key, entry: null });
    });

  

    // Autonavigation handler
    this.onMessage("auto_navigate", (client, message) => {
      console.log(`[DEBUG] Received auto_navigate message:`, message);
      const { targetX, targetY, moveInterval = 1000 } = message;
      console.log(`[DEBUG] Extracted target: (${targetX}, ${targetY}), interval: ${moveInterval}`);
      this.handleAutoNavigate(client, targetX, targetY, moveInterval);
    });
    
    // Visibility query (line-of-sight) for debugging or client use
    this.onMessage("is_visible", (client, message) => {
      const { sx, sy, tx, ty } = message || {};
      const visible = this.isVisible(sx, sy, tx, ty);
      client.send("is_visible_result", { sx, sy, tx, ty, visible });
    });
  }

  private generateDungeon(width: number, height: number, algorithm: string) {
    this.state.map.width = width;
    this.state.map.height = height;
    
    // Clear existing tiles
    this.state.map.tiles.clear();
    
    // Initialize with walls (1 = wall)
    for (let y = 0; y < height; y++) {
      const row = new TileRow();
      for (let x = 0; x < width; x++) {
        const tile = new Tile();
        tile.terrain = 1; // wall
        row.tiles.push(tile);
      }
      this.state.map.tiles.push(row);
    }
    
    console.log(`Generating ${width}x${height} dungeon using ${algorithm} algorithm`);
    
    switch (algorithm) {
      case 'bsp':
        this.generateBSPDungeon();
        break;
      case 'cellular':
        this.generateCellularDungeon();
        break;
      case 'drunkard':
        this.generateDrunkardDungeon();
        break;
      case 'rooms_corridors':
        this.generateRoomsAndCorridorsDungeon();
        break;
      default:
        this.generateBSPDungeon(); // Default to BSP
    }
    
    // Place player in a safe location
    this.placePlayerInSafeLocation();
    
    console.log(`Generated ${width}x${height} dungeon using ${algorithm}`);
  }

  private generateBSPDungeon() {
    const width = this.state.map.width;
    const height = this.state.map.height;
    
    // BSP (Binary Space Partitioning) dungeon generation
    const minRoomSize = 5;
    const maxRoomSize = 15;
    
    // Start with the whole map as one region
    const regions: Array<{x: number, y: number, width: number, height: number}> = [
      {x: 0, y: 0, width, height}
    ];
    
    // Recursively split regions
    const splitRegion = (region: any) => {
      const canSplitHorizontally = region.width >= minRoomSize * 2;
      const canSplitVertically = region.height >= minRoomSize * 2;
      
      if (!canSplitHorizontally && !canSplitVertically) {
        return [region]; // Can't split further
      }
      
      // Decide split direction
      let splitHorizontal = Math.random() > 0.5;
      if (!canSplitHorizontally) splitHorizontal = false;
      if (!canSplitVertically) splitHorizontal = true;
      
      if (splitHorizontal) {
        const splitY = region.y + Math.floor(region.height / 2);
        return [
          {x: region.x, y: region.y, width: region.width, height: splitY - region.y},
          {x: region.x, y: splitY, width: region.width, height: region.y + region.height - splitY}
        ];
      } else {
        const splitX = region.x + Math.floor(region.width / 2);
        return [
          {x: region.x, y: region.y, width: splitX - region.x, height: region.height},
          {x: splitX, y: region.y, width: region.x + region.width - splitX, height: region.height}
        ];
      }
    };
    
    // Generate rooms in regions
    for (let i = 0; i < regions.length; i++) {
      const region = regions[i];
      if (region.width < minRoomSize * 2 || region.height < minRoomSize * 2) {
        // Create a room in this region
        const roomWidth = Math.max(minRoomSize, Math.min(region.width - 2, maxRoomSize));
        const roomHeight = Math.max(minRoomSize, Math.min(region.height - 2, maxRoomSize));
        const roomX = region.x + Math.floor((region.width - roomWidth) / 2);
        const roomY = region.y + Math.floor((region.height - roomHeight) / 2);
        
        this.carveRoom(roomX, roomY, roomWidth, roomHeight);
      }
    }
  }

  private generateCellularDungeon() {
    const width = this.state.map.width;
    const height = this.state.map.height;
    
    // Cellular automata dungeon generation
    // Start with random noise
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = this.state.map.tiles[y].tiles[x];
        tile.terrain = Math.random() < 0.45 ? 1 : 0; // 45% chance of being a wall initially
      }
    }
    
    // Apply cellular automata rules
    for (let iteration = 0; iteration < 5; iteration++) {
      const newTerrain = new Array(height);
      for (let y = 0; y < height; y++) {
        newTerrain[y] = new Array(width);
      }
      
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const neighbors = this.countWallNeighbors(x, y);
          const currentTile = this.state.map.tiles[y].tiles[x];
          
          // If tile is a wall and has 4+ wall neighbors, stay a wall
          if (currentTile.terrain === 1 && neighbors >= 4) {
            newTerrain[y][x] = 1;
          }
          // If tile is empty and has 5+ wall neighbors, become a wall
          else if (currentTile.terrain === 0 && neighbors >= 5) {
            newTerrain[y][x] = 1;
          }
          // Otherwise become empty
          else {
            newTerrain[y][x] = 0;
          }
        }
      }
      
      // Apply new terrain
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          this.state.map.tiles[y].tiles[x].terrain = newTerrain[y][x];
        }
      }
    }
    
    // Ensure borders are walls
    for (let x = 0; x < width; x++) {
      this.state.map.tiles[0].tiles[x].terrain = 1; // Top
      this.state.map.tiles[height - 1].tiles[x].terrain = 1; // Bottom
    }
    for (let y = 0; y < height; y++) {
      this.state.map.tiles[y].tiles[0].terrain = 1; // Left
      this.state.map.tiles[y].tiles[width - 1].terrain = 1; // Right
    }
  }

  private generateDrunkardDungeon() {
    const width = this.state.map.width;
    const height = this.state.map.height;
    
    // Drunkard's walk dungeon generation
    const drunkardWalks = 100;
    const walkLength = 50;
    
    for (let walk = 0; walk < drunkardWalks; walk++) {
      // Start from a random position
      let x = Math.floor(Math.random() * width);
      let y = Math.floor(Math.random() * height);
      
      // Walk around carving floors
      for (let step = 0; step < walkLength; step++) {
        if (x >= 0 && x < width && y >= 0 && y < height) {
          const tile = this.state.map.tiles[y].tiles[x];
          tile.terrain = 0; // Carve floor
        }
        
        // Random walk
        const direction = Math.floor(Math.random() * 4);
        switch (direction) {
          case 0: y--; break; // Up
          case 1: y++; break; // Down
          case 2: x--; break; // Left
          case 3: x++; break; // Right
        }
        
        // Keep within bounds
        x = Math.max(1, Math.min(width - 2, x));
        y = Math.max(1, Math.min(height - 2, y));
      }
    }
  }

  private generateRoomsAndCorridorsDungeon() {
    const width = this.state.map.width;
    const height = this.state.map.height;
    const numRooms = 15;
    const minRoomSize = 4;
    const maxRoomSize = 10;
    
    const rooms: Array<{x: number, y: number, width: number, height: number}> = [];
    
    // Generate random rooms
    for (let i = 0; i < numRooms; i++) {
      const roomWidth = minRoomSize + Math.floor(Math.random() * (maxRoomSize - minRoomSize));
      const roomHeight = minRoomSize + Math.floor(Math.random() * (maxRoomSize - minRoomSize));
      const roomX = 1 + Math.floor(Math.random() * (width - roomWidth - 2));
      const roomY = 1 + Math.floor(Math.random() * (height - roomHeight - 2));
      
      // Check if room overlaps with existing rooms
      let overlaps = false;
      for (const room of rooms) {
        if (roomX < room.x + room.width && roomX + roomWidth > room.x &&
            roomY < room.y + room.height && roomY + roomHeight > room.y) {
          overlaps = true;
          break;
        }
      }
      
      if (!overlaps) {
        rooms.push({x: roomX, y: roomY, width: roomWidth, height: roomHeight});
        this.carveRoom(roomX, roomY, roomWidth, roomHeight);
      }
    }
    
    // Connect rooms with corridors
    for (let i = 0; i < rooms.length - 1; i++) {
      const room1 = rooms[i];
      const room2 = rooms[i + 1];
      
      const startX = room1.x + Math.floor(room1.width / 2);
      const startY = room1.y + Math.floor(room1.height / 2);
      const endX = room2.x + Math.floor(room2.width / 2);
      const endY = room2.y + Math.floor(room2.height / 2);
      
      // Create L-shaped corridor
      if (Math.random() > 0.5) {
        // Horizontal first, then vertical
        this.carveCorridor(startX, startY, endX, startY);
        this.carveCorridor(endX, startY, endX, endY);
      } else {
        // Vertical first, then horizontal
        this.carveCorridor(startX, startY, startX, endY);
        this.carveCorridor(startX, endY, endX, endY);
      }
    }
  }

  private carveRoom(x: number, y: number, width: number, height: number) {
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        const mapX = x + dx;
        const mapY = y + dy;
        if (mapX >= 0 && mapX < this.state.map.width && 
            mapY >= 0 && mapY < this.state.map.height) {
          const tile = this.state.map.tiles[mapY].tiles[mapX];
          tile.terrain = 0; // floor
        }
      }
    }
  }

  private carveCorridor(x1: number, y1: number, x2: number, y2: number) {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        if (x >= 0 && x < this.state.map.width && 
            y >= 0 && y < this.state.map.height) {
          const tile = this.state.map.tiles[y].tiles[x];
          tile.terrain = 0; // floor
        }
      }
    }
  }

  private countWallNeighbors(x: number, y: number): number {
    let count = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx < 0 || nx >= this.state.map.width || 
            ny < 0 || ny >= this.state.map.height) {
          count++; // Out of bounds counts as wall
        } else {
          const tile = this.state.map.tiles[ny].tiles[nx];
          if (tile.terrain === 1) count++;
        }
      }
    }
    return count;
  }

  private placePlayerInSafeLocation() {
    const width = this.state.map.width;
    const height = this.state.map.height;
    
    // Find a safe location (floor tile) for the player
    for (let attempts = 0; attempts < 1000; attempts++) {
      const x = Math.floor(Math.random() * width);
      const y = Math.floor(Math.random() * height);
      const tile = this.state.map.tiles[y].tiles[x];
      
      if (tile && tile.terrain === 0) { // Floor tile
        this.state.player.x = x;
        this.state.player.y = y;
        console.log(`Placed player at (${x}, ${y})`);
        return;
      }
    }
    
    // Fallback: place in center
    this.state.player.x = Math.floor(width / 2);
    this.state.player.y = Math.floor(height / 2);
  }

  private initializePlayerStats() {
    this.state.player.name = "Player";
    this.state.player.hp = 100;
    this.state.player.max_hp = 100;
    this.state.player.mana = 50;
    this.state.player.strength = 45;
    this.state.player.dexterity = 38;
    this.state.player.constitution = 42;
    this.state.player.intelligence = 32;
    this.state.player.wisdom = 38;
    this.state.player.charisma = 32;
    this.state.player.armor_class = 32;
    // movement speed removed from schema to ensure consistent client/server definitions
    this.state.player.proficiency_bonus = 6;

    this.recalculateDefenseFromEquipment();
  }

  private addStarterItems() {
    // Add starter items like in main.py
    this.state.player.inventory.push("Shortsword");
    this.state.player.inventory.push("Shortbow");
  }

  private getAnEmptyTile(): { x: number, y: number } | null {
    const tiles = this.getEmptyTiles();
    if (!tiles || tiles.length === 0) {
      return null;
    }
    const n = Math.floor(Math.random() * tiles.length);
    return tiles[n] || null;
  }

  private getEmptyTiles() {
    const emptyTiles: Array<{x: number, y: number}> = [];
    // Search entire map for empty, walkable tiles
    for (let y = 0; y < this.state.map.height; y++) {
      for (let x = 0; x < this.state.map.width; x++) {
        // Skip player position
        if (x === this.state.player.x && y === this.state.player.y) continue;
        
        // Check if tile is walkable using new tile structure
        const tile = this.state.map.tiles[y].tiles[x];
        if (tile && walkableTiles.has(tile.terrain)) {
          
          // Check if position is not occupied by another item
          if (tile.items.length === 0 && tile.monsters.length === 0) {
            emptyTiles.push({ x, y });
          }
        }
      }
    }
    return emptyTiles;
  }

  private scatterItems() {
    console.log("Starting scatterItems function");
    
    // Helper to add item at position
    const addItem = (x: number, y: number, itemKey: string, itemEntry: any) => {
      const tile = this.state.map.tiles[y].tiles[x];
      
      // Prevent too many items per tile
      if (tile.items.length >= 5) {
        console.log("Tile is full, not adding more items");
        return;
      }
      
      const item = new WorldItem();
      item.name = itemKey; // Use the synset key for inventory
      item.type = itemEntry.type; // Use the type from ItemData
      tile.items.push(item);
      console.log(`Added item ${itemKey} at (${x}, ${y})`);
    };

    // Get available item types from ItemData
    const itemTypes = ['weapons', 'armor', 'spells']; // Add more types as needed
    const availableItems: Array<{key: string, entry: any}> = [];
    
    const items = this.itemData.query({ type: 'weapons', limit: 5 });
    if (!items || items.length === 0) {
      console.log("No items found in ItemData.query");
      return; // nothing to scatter
    }
    
    console.log(`Found ${items.length} items to scatter`);
    
    for (let i = 0; i < GAME_CONSTANTS.SCATTER_ITEMS; i++) {
      const randomItem = items[Math.floor(Math.random() * items.length)];
      if (!randomItem) { continue; }
      const pos = this.getAnEmptyTile();
      if (!pos) {
        console.log("No empty tiles available for scattering");
        break; // no available tiles to scatter items
      }
      // key property is no longer valid but we need items to have results first
      addItem(pos.x, pos.y, randomItem.key, randomItem.entry);
    }

    console.log(`Scattered ${GAME_CONSTANTS.SCATTER_ITEMS} items`);
  }

  private handleSpacebarAttack(client: Client, player: PlayerState) {
    // Attack in all 8 adjacent tiles around the player
    const adjacentPositions = [
      { x: player.x - 1, y: player.y - 1 }, // NW
      { x: player.x, y: player.y - 1 },     // N
      { x: player.x + 1, y: player.y - 1 }, // NE
      { x: player.x - 1, y: player.y },     // W
      { x: player.x + 1, y: player.y },     // E
      { x: player.x - 1, y: player.y + 1 }, // SW
      { x: player.x, y: player.y + 1 },     // S
      { x: player.x + 1, y: player.y + 1 }  // SE
    ];

    const hitTargets: Array<{x: number, y: number, type: string, name: string}> = [];
    
    client.send("attack_result", {
      targets: hitTargets,
      message: hitTargets.length > 0 
        ? `Hit ${hitTargets.length} targets!` 
        : "No targets in range."
    });

    console.log(`${player.name} performed spacebar attack, hit ${hitTargets.length} targets`);

    // Broadcast attack summary to the player
    const info = hitTargets.length > 0
      ? `You swing and hit ${hitTargets.length} target${hitTargets.length === 1 ? "" : "s"}.`
      : "You swing but hit nothing.";
    ClientMessages.info(client, info);
  }

  private handleAttack(client: Client, message: any) {
    const player = this.state.player; // Fixed: player is stored directly
    if (!player) return;

    const targetX = message.targetX;
    const targetY = message.targetY;
    
    // Simple attack logic - attack adjacent tile
    const distance = Math.abs(player.x - targetX) + Math.abs(player.y - targetY);
    if (distance === 1) {
      console.log(`${player.name} attacks position (${targetX}, ${targetY})`);
      // Describe target if present
      const tile = this.state.map.tiles[targetY].tiles[targetX];
      const targetDesc = tile && tile.monsters.length > 0 ? (tile.monsters[0].name || "monster") : null;

      // TODO: Add actual combat logic with CombatCommand
      client.send("combat_result", { 
        message: targetDesc ? `You attack the ${targetDesc}!` : "You swing at the air.",
        targetX, 
        targetY 
      });
      // Also broadcast via info channel
      ClientMessages.info(client, targetDesc ? `You attack the ${targetDesc}.` : "You attack, but there is nothing there.");
    } else {
      client.send("error", { message: "Target too far away!" });
    }
  }

  private handleSpellCast(client: Client, message: any) {
    const player = this.state.player; // Fixed: player is stored directly
    if (!player) return;

    const spellName = message.spellName;
    const targetX = message.targetX;
    const targetY = message.targetY;
    
    // Simple spell casting logic
    if (player.mana >= 10) {
      player.mana -= 10;
      console.log(`${player.name} casts ${spellName} at (${targetX}, ${targetY})`);
      client.send("spell_result", { message: `Cast ${spellName}!`, targetX, targetY, mana: player.mana });
    } else {
      client.send("error", { message: "Not enough mana!" });
    }
  }

  onJoin(client: Client, options: any) {
    console.log("Client joined:", client.sessionId);
    // Track the player's client for AI notifications
    this.playerClient = client;
    
    // Don't send language data automatically - let client request it
    // client.send("language_data_init", {
    //   entries: this.languageData.entries,
    //   totalEntries: this.languageData.entries.size
    // });
    
    // Create player (using existing logic)
    const player = new PlayerSchema();
    player.name = options.name || "Player";
    
    // Find valid spawn location (not in walls)
    let spawnX, spawnY;
    let attempts = 0;
    const maxAttempts = 100;
    
    do {
      spawnX = Math.floor(Math.random() * this.state.map.width);
      spawnY = Math.floor(Math.random() * this.state.map.height);
      attempts++;
      
      // Check if position is valid floor tile (0 = floor)
      const tile = this.state.map.tiles[spawnY].tiles[spawnX];
      
      if (tile && tile.terrain === 0) {
        break; // Found valid spawn location
      }
    } while (attempts < maxAttempts);
    
    if (attempts >= maxAttempts) {
      console.warn("Could not find valid spawn location, using center");
      spawnX = Math.floor(this.state.map.width / 2);
      spawnY = Math.floor(this.state.map.height / 2);
    }
    
    player.x = spawnX;
    player.y = spawnY;
    console.log(`Placed player at (${spawnX}, ${spawnY}) after ${attempts} attempts`);
    player.hp = 100;
    player.max_hp = 100;
    player.mana = 50;
    player.strength = 32;
    player.dexterity = 32;
    player.constitution = 32;
    player.intelligence = 32;
    player.wisdom = 32;
    player.charisma = 32;
    player.armor_class = 32;
    // movement speed removed from schema to ensure consistent client/server definitions
    player.proficiency_bonus = 6;
    player.inventory = new ArraySchema<string>();
    // Initialize slots with proper schema objects
    this.state.player = player;
    console.log("Created player:", this.state.player.name);
  }

  // Pathfinding function using A* algorithm
  private findPath(startX: number, startY: number, endX: number, endY: number): Array<{x: number, y: number}> | null {
    const width = this.state.map.width;
    const height = this.state.map.height;
    
    // Check if start or end are walls
    if (!this.isWalkable(startX, startY) || !this.isWalkable(endX, endY)) {
      return null;
    }
    
    // A* algorithm
    const openSet: Array<{x: number, y: number, g: number, h: number, f: number, parent: {x: number, y: number} | null}> = [];
    const closedSet: Set<string> = new Set();
    const startNode = { x: startX, y: startY, g: 0, h: 0, f: 0, parent: null };
    
    openSet.push(startNode);
    
    while (openSet.length > 0) {
      // Find node with lowest f score
      let currentIndex = 0;
      for (let i = 1; i < openSet.length; i++) {
        if (openSet[i].f < openSet[currentIndex].f) {
          currentIndex = i;
        }
      }
      
      const current = openSet[currentIndex];
      
      // Check if we reached the target
      if (current.x === endX && current.y === endY) {
        const path: Array<{x: number, y: number}> = [];
        let temp: typeof current | null = current;
        while (temp) {
          path.push({ x: temp.x, y: temp.y });
          temp = temp.parent;
        }
        return path.reverse();
      }
      
      // Move current from open to closed
      openSet.splice(currentIndex, 1);
      closedSet.add(`${current.x},${current.y}`);
      
      // Check neighbors
      const neighbors = [
        { x: current.x - 1, y: current.y },
        { x: current.x + 1, y: current.y },
        { x: current.x, y: current.y - 1 },
        { x: current.x, y: current.y + 1 }
      ];
      
      for (const neighbor of neighbors) {
        // Skip if out of bounds or not walkable or already in closed
        if (neighbor.x < 0 || neighbor.x >= width || neighbor.y < 0 || neighbor.y >= height) continue;
        if (!this.isWalkable(neighbor.x, neighbor.y)) continue;
        if (closedSet.has(`${neighbor.x},${neighbor.y}`)) continue;
        
        const g = current.g + 1;
        const h = Math.abs(neighbor.x - endX) + Math.abs(neighbor.y - endY);
        const f = g + h;
        
        // Check if neighbor is already in open set
        const existingIndex = openSet.findIndex(n => n.x === neighbor.x && n.y === neighbor.y);
        if (existingIndex === -1) {
          openSet.push({ x: neighbor.x, y: neighbor.y, g, h, f, parent: current });
        } else if (g < openSet[existingIndex].g) {
          openSet[existingIndex] = { x: neighbor.x, y: neighbor.y, g, h, f, parent: current };
        }
      }
    }
    
    return null; // No path found
  }
  
  private isWalkable(x: number, y: number): boolean {
    if (x < 0 || x >= this.state.map.width || y < 0 || y >= this.state.map.height) {
      return false;
    }
    
    const tile = this.state.map.tiles[y].tiles[x];
    if (!tile || tile.terrain !== 0) return false; // Not floor or empty
    
    // Check for monster collision
    if (tile.monsters.length > 0) return false; // Monster blocks path
    
    return true;
  }

  /**
   * Line-of-sight visibility check between two points using Bresenham's algorithm.
   * Returns true if there is an unobstructed line (no walls) from (sx, sy) to (tx, ty).
   */
  private isVisible(sx: number, sy: number, tx: number, ty: number): boolean {
    const width = this.state.map.width;
    const height = this.state.map.height;

    // Bounds check for endpoints
    if (sx < 0 || sy < 0 || sx >= width || sy >= height) return false;
    if (tx < 0 || ty < 0 || tx >= width || ty >= height) return false;

    const isWall = (x: number, y: number) => {
      if (x < 0 || x >= width || y < 0 || y >= height) return true;
      const tile = this.state.map.tiles[y].tiles[x];
      // Treat non-floor tiles (e.g., walls=1) as blocking visibility
      return tile && tile.terrain === 1;
    };

    // Bresenham's line algorithm
    let x = sx;
    let y = sy;
    const dx = Math.abs(tx - sx);
    const dy = Math.abs(ty - sy);
    const sxStep = sx < tx ? 1 : -1;
    const syStep = sy < ty ? 1 : -1;
    let err = dx - dy;

    // Walk the line; skip starting cell when checking block
    while (true) {
      if (x === tx && y === ty) {
        return true; // Reached target with no blocking
      }

      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sxStep; }
      if (e2 <  dx) { err += dx; y += syStep; }

      // Bounds check during traversal
      if (x < 0 || y < 0 || x >= width || y >= height) {
        return false;
      }

      // If a wall blocks the line, not visible
      if (isWall(x, y)) {
        return false;
      }
    }
  }
  
  private handleAutoNavigate(client: Client, targetX: number, targetY: number, moveInterval: number) {
    const player = this.state.player;
    if (!player) return;
    
    // Clear any existing path for this player
    this.clearPlayerPath(client.sessionId);
    
    // Find path to target
    const path = this.findPath(player.x, player.y, targetX, targetY);
    
    if (!path) {
      client.send("auto_navigate_result", { success: false, message: "No path to target" });
      return;
    }
    
    // Store path and start movement
    this.playerPaths.set(client.sessionId, {
      path: path.slice(1), // Skip starting position
      currentIndex: 0,
      moveInterval: null
    });
    
    // Send path to client for highlighting
    client.send("auto_navigate_result", { 
      success: true, 
      path: path,
      message: `Path found with ${path.length} steps`
    });
    
    // Start movement
    this.startPlayerMovement(client);
  }
  
  private startPlayerMovement(client: Client) {
    const pathData = this.playerPaths.get(client.sessionId);
    if (!pathData) return;

    const player = this.state.player;
    const strength = player.strength || 32;
    const maxCarryWeight = strength * 2000; // grams; 1-64 scale strength gives ~2kg per point
    const currentWeight = player.inventory?.length || 0;
    let moveInterval = 100; // Base interval

    pathData.moveInterval = setInterval(() => {
      this.movePlayerAlongPath(client);
    }, moveInterval);
  }
  
  private movePlayerAlongPath(client: Client) {
    const player = this.state.player;
    const pathData = this.playerPaths.get(client.sessionId);
    
    if (!player || !pathData || pathData.currentIndex >= pathData.path.length) {
      this.clearPlayerPath(client.sessionId);
      client.send("auto_navigate_complete", { message: "Destination reached" });
      return;
    }
    
    const nextStep = pathData.path[pathData.currentIndex];
    
    // Check if next position is still walkable (obstacle check)
    if (!this.isWalkable(nextStep.x, nextStep.y)) {
      this.clearPlayerPath(client.sessionId);
      client.send("auto_navigate_stopped", { 
        message: "Path blocked by obstacle", 
        stoppedAt: { x: player.x, y: player.y }
      });
      return;
    }
    
    // Move player
    player.x = nextStep.x;
    player.y = nextStep.y;
    pathData.currentIndex++;
    
    // Send movement update
    client.send("auto_navigate_step", { 
      x: player.x, 
      y: player.y, 
      step: pathData.currentIndex,
      totalSteps: pathData.path.length
    });
  }
  
  private clearPlayerPath(sessionId: string) {
    const pathData = this.playerPaths.get(sessionId);
    if (pathData && pathData.moveInterval) {
      clearInterval(pathData.moveInterval);
    }
    this.playerPaths.delete(sessionId);
  }
  
  onLeave(client: Client) {
    // Clear player's path when they disconnect
    this.clearPlayerPath(client.sessionId);
    if (this.playerClient && this.playerClient.sessionId === client.sessionId) {
      this.playerClient = null;
    }
  }

  private handlePickup(client: Client, message: any) {
    const player = this.state.player; // Fixed: player is stored directly
    if (!player) return;

    // Get items from new tile structure
    const tile = this.state.map.tiles[player.y]?.tiles[player.x];
    if (!tile || tile.items.length === 0) {
      console.log(`No items at position (${player.x}, ${player.y})`);
      client.send("pickup_result", { message: "No item here to pick up." });
      return;
    }

    // Pick up the first item on the tile
    const item = tile.items[0];
    const itemIndex = 0;
    
    console.log(`Pickup attempt at (${player.x}, ${player.y}), item found:`, item);
    console.log(`Item name:`, item.name);
    console.log(`Item type:`, item.type);
    
    // Check if inventory has space (optional limit)
    if (player.inventory.length < 50) { // Reasonable inventory limit
      player.inventory.push(item.name);
      tile.items.splice(itemIndex, 1); // Remove from tile
      console.log(`${player.name} picked up ${item.name}`);
      console.log(`Inventory now contains:`, player.inventory);
      client.send("pickup_result", { message: `Picked up ${item.name}!`, item: item.name });
    } else {
      console.log(`${player.name} inventory is full`);
      client.send("error", { message: "Inventory is full!" });
    }
  }

  private handleDropItem(client: Client, message: any) {
    const player = this.state.player; // Fixed: player is stored directly
    if (!player) return;

    const itemName = message.itemName;
    const itemIndex = player.inventory.indexOf(itemName);
    
    if (itemIndex !== -1) {
      // Remove from inventory
      player.inventory.splice(itemIndex, 1);
      
      // Add to tile at player's position using new structure
      const tile = this.state.map.tiles[player.y]?.tiles[player.x];
      if (tile) {
        const item = new WorldItem();
        item.name = itemName;
        item.type = "weapon"; // Default type, could be enhanced
        tile.items.push(item);
        
        console.log(`${player.name} dropped ${itemName}`);
        client.send("drop_result", { message: `Dropped ${itemName}!`, item: itemName });
      } else {
        console.log(`Cannot drop item - no valid tile at (${player.x}, ${player.y})`);
        client.send("error", { message: "Cannot drop item here!" });
      }
    } else {
      client.send("error", { message: "Item not found in inventory!" });
    }
  }

  private handleEquip(client: Client, message: any) {
    const player = this.state.player;
    if (!player) return;

    const { slotPath, itemName } = message;
    
    // Check if item is in inventory
    if (!player.inventory.includes(itemName)) {
      client.send("error", { message: "Item not found in inventory!" });
      return;
    }

    // Parse slot path (e.g., "hand_slots.main_hand")
    const slotParts = slotPath.split('.');
    if (slotParts.length !== 2) {
      client.send("error", { message: "Invalid slot path!" });
      return;
    }

    const [slotGroup, slotName] = slotParts;
    // Use equipment structure from schema
    const group: any = (player.equipment as any)[slotGroup];
    if (!group || group[slotName] === undefined) {
      client.send("error", { message: "Invalid slot!" });
      return;
    }

    // Get current item in slot (if any)
    const currentItem = group[slotName];
    
    // Remove item from inventory
    const itemIndex = player.inventory.indexOf(itemName);
    player.inventory.splice(itemIndex, 1);
    
    // Put current item back to inventory (if any)
    if (currentItem) {
      player.inventory.push(currentItem);
    }
    
    // Equip new item
    group[slotName] = itemName;
    
    this.recalculateDefenseFromEquipment();

    console.log(`${player.name} equipped ${itemName} to ${slotPath}`);
    client.send("equip_result", { message: `Equipped ${itemName} to ${slotName}!`, item: itemName, slotPath });
  }

  private handleUnequip(client: Client, message: any) {
    const player = this.state.player;
    if (!player) return;

    const { slotPath } = message;
    
    // Parse slot path (e.g., "hand_slots.main_hand")
    const slotParts = slotPath.split('.');
    if (slotParts.length !== 2) {
      client.send("error", { message: "Invalid slot path!" });
      return;
    }

    const [slotGroup, slotName] = slotParts;
    // Use equipment structure from schema
    const group: any = (player.equipment as any)[slotGroup];
    if (!group || !group[slotName]) {
      client.send("error", { message: "Slot is empty!" });
      return;
    }

    const currentItem = group[slotName];
    
    // Add item back to inventory
    player.inventory.push(currentItem);
    
    // Clear slot
    group[slotName] = '';

    this.recalculateDefenseFromEquipment();
    
    console.log(`${player.name} unequipped ${currentItem} from ${slotPath}`);
    client.send("unequip_result", { message: `Unequipped ${currentItem} from ${slotName}!`, item: currentItem, slotPath });
  }

    private monsterMash() {
      const monsterTypes = ['goblin', 'slime', 'orc', 'skeleton', 'troll'];
      const monsterType = monsterTypes[Math.floor(Math.random() * monsterTypes.length)];
      const monster = new MonsterState();
      monster.kind = monsterType;
      monster.info = {};
      monster.hp = 20;
      monster.hostile = true;
      return monster;
    }

  private spawnMonsters() {
    const walkableTiles = new Set([0, 3, 4, 5, 6]); // floor, corridor, room_floor, entrance, exit
    let monsterCount = 0;
    
    let emptyTiles = this.getEmptyTiles();
    if (!emptyTiles || emptyTiles.length === 0) {
      console.log("No empty tiles for monster spawning");
      return; // no places to spawn monsters
    }

    console.log(`Spawning ${GAME_CONSTANTS.SPAWN_MONSTERS} monsters on ${emptyTiles.length} empty tiles`);

    for (let i =0; i<GAME_CONSTANTS.SPAWN_MONSTERS; i++) {
      //randomly selected an emptyTiles
      const randomIndex = Math.floor(Math.random() * emptyTiles.length);
      const tile = emptyTiles[randomIndex];
      if (!tile) { continue; }
      
      const monster = this.monsterMash();
      const mapTile = this.state.map.tiles[tile.y].tiles[tile.x];
      mapTile.monsters.push(monster);
      monsterCount++;
      console.log(`Spawned monster ${i+1} at (${tile.x}, ${tile.y})`);
    }

    console.log(`Successfully spawned ${monsterCount} monsters`);
    return;
  }

  private startMonsterAI() {
    // Run monster AI every 2 seconds
    this.clock.setInterval(() => {
      this.updateMonsters();
    }, 2000);
  }

  private updateMonsters() {
    if (!this.state.player) return;

    const player = this.state.player;
    const walkableTiles = new Set([0, 3, 4, 5, 6]); // floor, corridor, room_floor, entrance, exit
    
    // Find all monsters in the world using new tile structure
    const monsters: Array<{x: number, y: number, item: any}> = [];
    
    for (let y = 0; y < this.state.map.height; y++) {
      for (let x = 0; x < this.state.map.width; x++) {
        const tile = this.state.map.tiles[y].tiles[x];
        for (const monster of tile.monsters) {
          monsters.push({ x, y, item: monster });
        }
      }
    }

    console.log(`Monster AI: Found ${monsters.length} monsters to update`);

    console.log(`Found ${monsters.length} monsters to update`);

    // Move each monster towards player
    for (const monster of monsters) {
      // Calculate distance to player
      const distance = Math.abs(monster.x - player.x) + Math.abs(monster.y - player.y);
      
      console.log(`Monster at (${monster.x}, ${monster.y}) is ${distance} tiles from player at (${player.x}, ${player.y})`);
      
      // Only move if monster is within 10 tiles and not already adjacent
      if (distance <= 10 && distance > 1) {
        console.log(`Monster at (${monster.x}, ${monster.y}) is in range and will try to move`);
        
        // Simple pathfinding - move one step towards player
        if (this.isVisible(monster.x, monster.y, player.x, player.y) === true) {
          const nextPos = this.getNextPositionTowards(monster.x, monster.y, player.x, player.y);
          
          console.log(`Next position for monster:`, nextPos);
          
          if (nextPos && this.isValidPosition(nextPos.x, nextPos.y, walkableTiles)) {
            // Remove monster from old position
            this.moveMonster(monster, nextPos);
            console.log(`Monster moved from (${monster.x}, ${monster.y}) to (${nextPos.x}, ${nextPos.y})`);
          } else {
            console.log(`Monster cannot move to next position - invalid or blocked`);
          }
        } else {
          console.log(`Monster cannot see player - no line of sight`);
        }
      } else {
        console.log(`Monster at (${monster.x}, ${monster.y}) is out of range (${distance}) or adjacent`);
        
        // If adjacent after move, notify player
        const dx = Math.abs(monster.x - player.x);
        const dy = Math.abs(monster.y - player.y);
        const adjacent = Math.max(dx, dy) === 1;
        
        if (adjacent && this.playerClient) {
          const name = monster.item.name || "monster";

          // Build attacker and target entities for combat resolution
          const attacker = {
            name,
            combat_stats: {
              hp: 20,
              max_hp: 20,
              armor_class: 32,
              strength: 32,
              dexterity: 32,
              constitution: 32,
              intelligence: 32,
              wisdom: 32,
              charisma: 32,
              proficiency_bonus: 6,
            },
          };

          const playerStats = this.state.player;
          const target = {
            name: playerStats.name,
            combat_stats: {
              hp: playerStats.hp,
              max_hp: playerStats.max_hp,
              armor_class: playerStats.armor_class,
              strength: playerStats.strength,
              dexterity: playerStats.dexterity,
              constitution: playerStats.constitution,
              intelligence: playerStats.intelligence,
              wisdom: playerStats.wisdom,
              charisma: playerStats.charisma,
              proficiency_bonus: playerStats.proficiency_bonus,
            },
          };

          const weapon = new Weapon();
          weapon.name = "claws";
          weapon.damage = 8; // flat damage on 1-64 scale
          weapon.damage_type = "slashing" as any;

          const log: CombatLog = CombatCommand.resolveAttack(attacker, target, weapon);
          // Sync computed HP back to schema
          this.state.player.hp = target.combat_stats.hp;

          // Broadcast concise combat summary to the player
          ClientMessages.info(this.playerClient, log.message);

          // Optional: additional HUD-friendly summary
          if (typeof log.damage === "number") {
            ClientMessages.log(
              this.playerClient,
              `You take ${log.damage} damage. HP ${this.state.player.hp}/${this.state.player.max_hp}.`
            );
          }

          // If player is defeated, notify
          if (this.state.player.hp <= 0) {
            ClientMessages.error(this.playerClient, "You fall unconscious!");
          }
        } else {
          // make the monster wander randomly if player not visible
          const d = [{x: -1, y: 0}, {x: 1, y: 0}, {x: 0, y: -1}, {x: 0, y: 1}];
          const n = Math.floor(Math.random() * 3);
          const r = d[n];
          const nextPos = { x: monster.x + d[n].x, y: monster.y + d[n].y };
          if (this.isValidPosition(nextPos.x, nextPos.y, walkableTiles)) {
            // console.log(`Monster wandered from (${monster.x}, ${monster.y}) to (${nextPos})`);
            this.moveMonster(monster, nextPos);
          }
        }
      }
    }
  }

  // --- Item scaling helpers (1-64 damage/defense) ---
  private async loadItemScales() {
    if (this.weaponDamageMap.size || this.armorDefenseMap.size) return;

    const basePath = process.cwd();
    const weaponPath = path.resolve(basePath, "data/64-melee-weapons.json");
    const armorPath = path.resolve(basePath, "data/64-armors.json");

    try {
      const weaponsRaw = await fsp.readFile(weaponPath, "utf8");
      const weapons = JSON.parse(weaponsRaw);
      weapons.forEach((w: any) => {
        if (typeof w.name === "string" && typeof w.damage === "number") {
          this.weaponDamageMap.set(w.name.toLowerCase(), w.damage);
        }
      });
    } catch (err) {
      console.warn("Unable to load weapon scale data", err);
    }

    try {
      const armorsRaw = await fsp.readFile(armorPath, "utf8");
      const armors = JSON.parse(armorsRaw);
      armors.forEach((a: any) => {
        if (typeof a.name === "string" && typeof a.armor_class === "number") {
          this.armorDefenseMap.set(a.name.toLowerCase(), a.armor_class);
        }
      });
    } catch (err) {
      console.warn("Unable to load armor scale data", err);
    }
  }

  private lookupArmorDefense(name: string | undefined | null): number | null {
    if (!name) return null;
    const found = this.armorDefenseMap.get(name.toLowerCase());
    return typeof found === "number" ? found : null;
  }

  private recalculateDefenseFromEquipment() {
    const player = this.state.player;
    if (!player || !player.equipment) return;

    // Start from baseline defense
    let defense = player.armor_class || 32;

    const equipped: Array<string> = [];
    const handSlots = player.equipment.hand_slots;
    if (handSlots.main_hand) equipped.push(handSlots.main_hand);
    if (handSlots.off_hand) equipped.push(handSlots.off_hand);
    const bodySlots = player.equipment.body_slots as any;
    Object.keys(bodySlots).forEach(slot => {
      const itemName = bodySlots[slot];
      if (itemName) equipped.push(itemName);
    });

    for (const itemName of equipped) {
      const value = this.lookupArmorDefense(itemName);
      if (value !== null) {
        defense = Math.max(defense, value);
      }
    }

    player.armor_class = defense;
  }

  private moveMonster(monster: {x:number,y:number,item:any}, point: {x:number,y:number}) {
      // Remove monster from old position
      const oldTile = this.state.map.tiles[monster.y].tiles[monster.x];
      const monsterIndex = oldTile.monsters.indexOf(monster.item);
      if (monsterIndex !== -1) {
        oldTile.monsters.splice(monsterIndex, 1);
      }
      
      // Add monster to new position
      const newTile = this.state.map.tiles[point.y].tiles[point.x];
      newTile.monsters.push(monster.item);
      
      // Update local monster coordinates
      monster.x = point.x;
      monster.y = point.y;
    }


  private getNextPositionTowards(fromX: number, fromY: number, toX: number, toY: number): {x: number, y: number} | null {
    const dx = toX - fromX;
    const dy = toY - fromY;
    
    // Determine primary direction
    if (Math.abs(dx) > Math.abs(dy)) {
      // Move horizontally
      return { x: fromX + Math.sign(dx), y: fromY };
    } else if (Math.abs(dy) > 0) {
      // Move vertically
      return { x: fromX, y: fromY + Math.sign(dy) };
    }
    
    return null;
  }

  private isValidPosition(x: number, y: number, walkableTiles: Set<number>): boolean {
    // Check bounds
    if (x < 0 || x >= this.state.map.width || y < 0 || y >= this.state.map.height) {
      return false;
    }
    
    // Check if tile exists and is walkable using new tile structure
    if (!this.state.map.tiles[y] || !this.state.map.tiles[y].tiles[x]) {
      return false;
    }
    
    if (!walkableTiles.has(this.state.map.tiles[y].tiles[x].terrain)) {
      return false;
    }
    
    // Check if position is occupied by player
    if (this.state.player.x === x && this.state.player.y === y) {
      return false;
    }
    
    // Check if position is occupied by another monster
    const tile = this.state.map.tiles[y].tiles[x];
    if (tile.monsters.length > 0) {
      return false;
    }
    
    return true;
  }
}