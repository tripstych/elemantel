import { Room, Client } from "@colyseus/core";
import { MyRoomState, Item, PlayerState } from "./schema/MyRoomState";
import { ArraySchema, Schema, type, MapSchema, Encoder } from "@colyseus/schema";
import { CombatCommand, CombatLog } from "../commands/CombatCommand";
import * as fs from 'fs';
import * as path from 'path';

// Increase buffer size for large language data
Encoder.BUFFER_SIZE = 16 * 1024; // 16 KB

// Temporary inline LanguageData schema to avoid import issues
class ElementalOrigin extends Schema {
  @type("number") fire: number = 0;
  @type("number") water: number = 0;
  @type("number") earth: number = 0;
  @type("number") air: number = 0;
}

class SpellEffect extends Schema {
  @type("string") type: string = "";
  @type("string") amount: string = "";
}

class LanguageEntry extends Schema {
  @type("string") word: string = "";
  @type("string") definition: string = "";
  @type(ElementalOrigin) elemental_origin: ElementalOrigin = new ElementalOrigin();
  @type("string") spirit: string = "";
  @type("number") weight: number = 0;
  @type("string") composition: string = "";
  @type(SpellEffect) spell_effect: SpellEffect = new SpellEffect();
  @type("string") type: string = "";
}

class LanguageData extends Schema {
  @type({ map: LanguageEntry }) entries: MapSchema<LanguageEntry> = new MapSchema<LanguageEntry>();
  
  loadFromJSON(jsonData: any) {
    this.entries.clear();
    for (const [key, value] of Object.entries(jsonData)) {
      const entry = new LanguageEntry();
      entry.word = (value as any).word || "";
      entry.definition = (value as any).definition || "";
      entry.spirit = (value as any).spirit || "";
      entry.weight = (value as any).weight || 0;
      entry.type = (value as any).type || "";
      
      // Handle elemental_origin
      if ((value as any).elemental_origin) {
        entry.elemental_origin.fire = (value as any).elemental_origin.fire || 0;
        entry.elemental_origin.water = (value as any).elemental_origin.water || 0;
        entry.elemental_origin.earth = (value as any).elemental_origin.earth || 0;
        entry.elemental_origin.air = (value as any).elemental_origin.air || 0;
      }
      
      // Handle composition as string (JSON object)
      if ((value as any).composition) {
        entry.composition = JSON.stringify((value as any).composition);
      }
      
      // Handle spell_effect
      if ((value as any).spell_effect) {
        entry.spell_effect.type = String((value as any).spell_effect.type || "");
        entry.spell_effect.amount = String((value as any).spell_effect.amount || "");
      }
      
      this.entries.set(key, entry);
    }
  }
  
  getEntry(key: string): LanguageEntry | undefined {
    return this.entries.get(key);
  }
  
  searchEntries(query: string): LanguageEntry[] {
    const results: LanguageEntry[] = [];
    const lowerQuery = query.toLowerCase();
    
    for (const entry of this.entries.values()) {
      if (entry.word.toLowerCase().includes(lowerQuery) ||
          entry.definition.toLowerCase().includes(lowerQuery)) {
        results.push(entry);
      }
    }
    
    return results;
  }
}

// Data loading utilities
const dataPath = path.join(__dirname, '../../../data');

function loadJsonData(filename: string): any {
  const filePath = path.join(dataPath, filename);
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    console.log(`Loaded ${filename} from ${filePath}`);
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error loading ${filename}:`, error);
    return null;
  }
}

export class MyRoom extends Room<MyRoomState> {
  maxClients = 4;
  state = new MyRoomState();
  private gameData: any = {};
  private languageData: LanguageData = new LanguageData();
  private playerPaths: Map<string, { path: Array<{x: number, y: number}>, currentIndex: number, moveInterval: NodeJS.Timeout | null }> = new Map();
  private playerMoveTimes: Map<string, number> = new Map();

  onCreate (options: any) {
    console.log("Creating room with full main.py functionality");

    // Load shared data files
    const elementalDarkAlphabet = loadJsonData('elemental_dark_alphabet.json');
    const elementalDictionary = loadJsonData('elemental_dictionary.json');
    const elementalLightAlphabet = loadJsonData('elemental_light_alphabet.json');

    // Store data for game use
    this.gameData = {
      elementalDarkAlphabet,
      elementalDictionary,
      elementalLightAlphabet
    };

    // Load language data into schema
    if (elementalDictionary) {
      this.languageData.loadFromJSON(elementalDictionary);
      console.log(`Loaded ${this.languageData.entries.size} language entries`);
    }

    console.log("Game data loaded:", Object.keys(this.gameData));

    // Get dungeon generation options
    const width = options.width || 60;
    const height = options.height || 30;
    const algorithm = options.algorithm || 'bsp'; // 'bsp', 'cellular', 'drunkard', 'rooms_corridors'

    // Generate dungeon using specified algorithm
    this.generateDungeon(width, height, algorithm);

    // Add player stats
    this.initializePlayerStats();

    // Add starter items
    this.addStarterItems();

    // Scatter items throughout the world (like main.py)
    this.scatterItems();

    console.log("Room ready with full functionality");

    this.onMessage("move", (client, message) => {
      const player = this.state.player; // Fixed: player is stored directly, not in players Map
      if (!player) return;

      const dx = message.dx || 0;
      const dy = message.dy || 0;
      
      // Calculate movement interval based on inventory weight
      const strength = player.strength || 10;
      const maxCarryWeight = strength * 15 * 450;
      console.log(`[DEBUG] Backend - Strength: ${strength}, Max carry weight: ${maxCarryWeight}`);
      
      // Calculate current inventory weight (assuming each item weighs 1kg for now)
      const currentWeight = player.inventory?.length || 0;
      console.log(`[DEBUG] Backend - Current inventory weight: ${currentWeight}kg`);
      
      let moveInterval = 200; // Base interval
      if (currentWeight > maxCarryWeight) {
        const excessWeight = currentWeight - maxCarryWeight;
        const penalty = excessWeight * 15; // 15ms per kg over limit
        moveInterval += penalty;
        console.log(`[DEBUG] Backend - Overweight by ${excessWeight}kg, adding ${penalty}ms penalty`);
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
        // Check if tile is walkable (0 = floor) using flat array index
        const tileIndex = newY * this.state.map.width + newX;
        if (tileIndex >= 0 && tileIndex < this.state.map.tiles.length && 
            this.state.map.tiles[tileIndex] === 0) {
          player.x = newX;
          player.y = newY;
          this.playerMoveTimes.set(client.sessionId, now);
          console.log(`[DEBUG] Backend - Player moved to (${newX}, ${newY})`);
          console.log(`${player.name} moved to (${newX}, ${newY})`);
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

    this.onMessage("get_language_entry", (client, message) => {
      const key = message.key;
      const entry = this.languageData.getEntry(key);
      client.send("language_entry_result", { key, entry });
    });

    // Autonavigation handler
    this.onMessage("auto_navigate", (client, message) => {
      console.log(`[DEBUG] Received auto_navigate message:`, message);
      const { targetX, targetY, moveInterval = 1000 } = message;
      console.log(`[DEBUG] Extracted target: (${targetX}, ${targetY}), interval: ${moveInterval}`);
      this.handleAutoNavigate(client, targetX, targetY, moveInterval);
    });
  }

  private generateDungeon(width: number, height: number, algorithm: string) {
    this.state.map.width = width;
    this.state.map.height = height;
    
    // Clear existing tiles
    this.state.map.tiles.clear();
    
    // Initialize with walls (1 = wall)
    for (let i = 0; i < width * height; i++) {
      this.state.map.tiles.push(1);
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
        const index = y * width + x;
        // 45% chance of being a wall initially
        this.state.map.tiles[index] = Math.random() < 0.45 ? 1 : 0;
      }
    }
    
    // Apply cellular automata rules
    for (let iteration = 0; iteration < 5; iteration++) {
      const newTiles = new Array(width * height);
      
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const index = y * width + x;
          const neighbors = this.countWallNeighbors(x, y);
          
          // If tile is a wall and has 4+ wall neighbors, stay a wall
          if (this.state.map.tiles[index] === 1 && neighbors >= 4) {
            newTiles[index] = 1;
          }
          // If tile is empty and has 5+ wall neighbors, become a wall
          else if (this.state.map.tiles[index] === 0 && neighbors >= 5) {
            newTiles[index] = 1;
          }
          // Otherwise become empty
          else {
            newTiles[index] = 0;
          }
        }
      }
      
      // Apply new tiles
      for (let i = 0; i < width * height; i++) {
        this.state.map.tiles[i] = newTiles[i];
      }
    }
    
    // Ensure borders are walls
    for (let x = 0; x < width; x++) {
      this.state.map.tiles[x] = 1; // Top
      this.state.map.tiles[(height - 1) * width + x] = 1; // Bottom
    }
    for (let y = 0; y < height; y++) {
      this.state.map.tiles[y * width] = 1; // Left
      this.state.map.tiles[y * width + (width - 1)] = 1; // Right
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
          const index = y * width + x;
          this.state.map.tiles[index] = 0; // Carve floor
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
          const index = mapY * this.state.map.width + mapX;
          this.state.map.tiles[index] = 0; // floor
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
          const index = y * this.state.map.width + x;
          this.state.map.tiles[index] = 0; // floor
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
          const index = ny * this.state.map.width + nx;
          if (this.state.map.tiles[index] === 1) count++;
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
      const index = y * width + x;
      
      if (this.state.map.tiles[index] === 0) { // Floor tile
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
    this.state.player.strength = 14;
    this.state.player.dexterity = 12;
    this.state.player.constitution = 13;
    this.state.player.intelligence = 10;
    this.state.player.wisdom = 12;
    this.state.player.charisma = 10;
    this.state.player.armor_class = 10;
    this.state.player.speed = 30;
    this.state.player.proficiency_bonus = 2;
  }

  private addStarterItems() {
    // Add starter items like in main.py
    this.state.player.inventory.push("Shortsword");
    this.state.player.inventory.push("Shortbow");
  }

  private scatterItems() {
    const catalog = [
      { name: "Potion", type: "consumable" },
      { name: "Scroll", type: "consumable" },
      { name: "Gold", type: "currency" },
      { name: "Gem", type: "treasure" },
      { name: "Arrow", type: "ammunition" },
      { name: "Dagger", type: "weapon" },
      { name: "Torch", type: "tool" }
    ];

    // Helper to add item at position
    const addItem = (x: number, y: number, itemData: any) => {
      const key = `${x},${y}`;
      
      // Prevent world from getting too large
      if (this.state.world.size > 1000) {
        console.log("World is full, not adding more items");
        return;
      }
      
      const item = new Item();
      item.name = itemData.name;
      item.type = itemData.type;
      this.state.world.set(key, item);
    };

    // Scatter a few items near player for testing
    const nearCount = 2;
    const offsets = [
      { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 0, dy: -1 }
    ];

    let placed = 0;
    for (const offset of offsets) {
      if (placed >= nearCount) break;

      const x = this.state.player.x + offset.dx;
      const y = this.state.player.y + offset.dy;

      if (x >= 0 && x < this.state.map.width && 
          y >= 0 && y < this.state.map.height) {
        
        // Check if tile is walkable using flat array
        const tileIndex = y * this.state.map.width + x;
        if (tileIndex >= 0 && tileIndex < this.state.map.tiles.length && 
            this.state.map.tiles[tileIndex] === 0) { // 0 = floor
          
          addItem(x, y, catalog[Math.floor(Math.random() * catalog.length)]);
          placed++;
        }
      }
    }
    
    console.log(`Scattered ${placed} items near player`);
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
      // TODO: Add actual combat logic with CombatCommand
      client.send("combat_result", { message: "Attack executed!", targetX, targetY });
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
    
    // Don't send language data automatically - let client request it
    // client.send("language_data_init", {
    //   entries: this.languageData.entries,
    //   totalEntries: this.languageData.entries.size
    // });
    
    // Create player (using existing logic)
    const player = new PlayerState();
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
      const tileIndex = spawnY * this.state.map.width + spawnX;
      const tile = this.state.map.tiles[tileIndex];
      
      if (tile === 0 || tile === undefined) {
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
    player.strength = 10;
    player.dexterity = 10;
    player.constitution = 10;
    player.intelligence = 10;
    player.wisdom = 10;
    player.charisma = 10;
    player.armor_class = 10;
    player.speed = 30;
    player.proficiency_bonus = 2;
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
    const tileIndex = y * this.state.map.width + x;
    const tile = this.state.map.tiles[tileIndex];
    return tile === 0 || tile === undefined; // 0 = floor, undefined = empty
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
    this.startPlayerMovement(client, moveInterval);
  }
  
  private startPlayerMovement(client: Client, moveInterval: number) {
    const pathData = this.playerPaths.get(client.sessionId);
    if (!pathData) return;
    
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
  }

  private handlePickup(client: Client, message: any) {
    const player = this.state.player; // Fixed: player is stored directly
    if (!player) return;

    const key = `${player.x},${player.y}`;
    const item = this.state.world.get(key);
    
    console.log(`Pickup attempt at ${key}, item found:`, !!item);
    
    if (item) {
      // Check if inventory has space (optional limit)
      if (player.inventory.length < 50) { // Reasonable inventory limit
        player.inventory.push(item.name);
        this.state.world.delete(key);
        console.log(`${player.name} picked up ${item.name}`);
        client.send("pickup_result", { message: `Picked up ${item.name}!`, item: item.name });
      } else {
        console.log(`${player.name} inventory is full`);
        client.send("error", { message: "Inventory is full!" });
      }
    } else {
      console.log(`No item at position ${key}`);
      client.send("pickup_result", { message: "No item here to pick up." });
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
      
      // Add to world at player's position
      const key = `${player.x},${player.y}`;
      const item = new Item();
      item.name = itemName;
      item.type = "weapon"; // Default type, could be enhanced
      this.state.world.set(key, item);
      
      console.log(`${player.name} dropped ${itemName}`);
      client.send("drop_result", { message: `Dropped ${itemName}!`, item: itemName });
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
    
    // Check if slot exists
    if (!player.slots[slotGroup] || player.slots[slotGroup][slotName] === undefined) {
      client.send("error", { message: "Invalid slot!" });
      return;
    }

    // Get current item in slot (if any)
    const currentItem = player.slots[slotGroup][slotName];
    
    // Remove item from inventory
    const itemIndex = player.inventory.indexOf(itemName);
    player.inventory.splice(itemIndex, 1);
    
    // Put current item back to inventory (if any)
    if (currentItem) {
      player.inventory.push(currentItem);
    }
    
    // Equip new item
    player.slots[slotGroup][slotName] = itemName;
    
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
    
    // Check if slot exists and has an item
    if (!player.slots[slotGroup] || !player.slots[slotGroup][slotName]) {
      client.send("error", { message: "Slot is empty!" });
      return;
    }

    const currentItem = player.slots[slotGroup][slotName];
    
    // Add item back to inventory
    player.inventory.push(currentItem);
    
    // Clear slot
    player.slots[slotGroup][slotName] = '';
    
    console.log(`${player.name} unequipped ${currentItem} from ${slotPath}`);
    client.send("unequip_result", { message: `Unequipped ${currentItem} from ${slotName}!`, item: currentItem, slotPath });
  }
}
