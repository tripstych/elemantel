import { Room, Client } from "@colyseus/core";
import { MyRoomState, Item } from "./schema/MyRoomState";
import { ArraySchema } from "@colyseus/schema";
import { CombatCommand, CombatLog } from "../commands/CombatCommand";

export class MyRoom extends Room<MyRoomState> {
  maxClients = 4;
  state = new MyRoomState();

  onCreate (options: any) {
    console.log("Creating room with full main.py functionality");

    // Start with the working 5x5 room
    this.generateDungeon(5, 5);

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
  }

  private generateDungeon(width: number, height: number) {
    this.state.map.width = width;
    this.state.map.height = height;
    
    // Clear existing tiles
    this.state.map.tiles.clear();
    
    // Initialize with walls (1 = wall)
    for (let i = 0; i < width * height; i++) {
      this.state.map.tiles.push(1);
    }
    
    // Create a simple room in the center
    const roomWidth = Math.floor(width * 0.6);
    const roomHeight = Math.floor(height * 0.6);
    const roomX = Math.floor((width - roomWidth) / 2);
    const roomY = Math.floor((height - roomHeight) / 2);
    
    // Carve out the room (0 = floor)
    for (let y = roomY; y < roomY + roomHeight; y++) {
      for (let x = roomX; x < roomX + roomWidth; x++) {
        const index = y * width + x;
        if (index >= 0 && index < this.state.map.tiles.length) {
          this.state.map.tiles[index] = 0; // floor
        }
      }
    }
    
    // Place player in center of room
    this.state.player.x = Math.floor(width / 2);
    this.state.player.y = Math.floor(height / 2);
    
    console.log(`Generated ${width}x${height} dungeon with center room`);
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
    
    if (item) {
      player.inventory.push(item.name);
      this.state.world.delete(key);
      console.log(`${player.name} picked up ${item.name}`);
      client.send("pickup_result", { message: `Picked up ${item.name}!`, item: item.name });
    } else {
      client.send("error", { message: "No item here!" });
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
}
