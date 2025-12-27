import { Room, Client } from "@colyseus/core";
import { MyRoomState, Item } from "./schema/MyRoomState";
import { ArraySchema } from "@colyseus/schema";
import { CombatCommand, CombatLog } from "../commands/CombatCommand";

export class MyRoom extends Room<MyRoomState> {
  maxClients = 4;
  state = new MyRoomState();

  onCreate (options: any) {
    console.log("Creating room with full main.py functionality");

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
