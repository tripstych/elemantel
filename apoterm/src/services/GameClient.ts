import { Client, Room } from "colyseus.js";

export interface GameState {
  map: {
    width: number;
    height: number;
    tiles: number[]; // Flat array as used in MyRoomState
  };
  player: {
    name: string;
    x: number;
    y: number;
    hp: number;
    max_hp: number;
    mana: number;
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
    armor_class: number;
    speed: number;
    proficiency_bonus: number;
    inventory: string[];
  };
  players: Map<string, any>;
  world: Map<string, any>;
}

export class GameClient {
  private client: Client;
  private room: Room | null = null;
  private onStateChangeCallbacks: ((state: GameState) => void)[] = [];
  private onErrorCallbacks: ((error: any) => void)[] = [];
  private onConnectCallbacks: (() => void)[] = [];
  private onEquipResultCallbacks: ((result: any) => void)[] = [];
  private onUnequipResultCallbacks: ((result: any) => void)[] = [];
  private lastPlayerX: number | undefined;
  private lastPlayerY: number | undefined;

  constructor() {
    // Connect to Colyseus server (adjust port as needed)
    console.log("Creating GameClient, connecting to ws://localhost:2567");
    this.client = new Client("ws://localhost:2567");
  }

  async joinRoom(roomName: string = "my_room", options: any = {}) {
    try {
      console.log(`Attempting to join room: ${roomName}`, options);
      this.room = await this.client.joinOrCreate(roomName, options);
      
      console.log("Successfully joined room!");
      
      // Set up state change listener
      this.room.onStateChange((state: any) => {
        console.log("State changed:", state);
        // Convert Colyseus Schema objects to plain objects
        const plainState = this.convertToPlainObject(state);
        console.log("Plain state:", plainState);
        console.log("Player position in state:", plainState.player?.x, plainState.player?.y);
        console.log("Full player object:", plainState.player);
        
        // Check if this is actually a different state
        if (this.lastPlayerX !== plainState.player?.x || this.lastPlayerY !== plainState.player?.y) {
          console.log("PLAYER POSITION CHANGED from", this.lastPlayerX, this.lastPlayerY, "to", plainState.player?.x, plainState.player?.y);
        }
        this.lastPlayerX = plainState.player?.x;
        this.lastPlayerY = plainState.player?.y;
        
        this.notifyStateChange(plainState);
      });

      // Get initial state
      if (this.room.state) {
        console.log("Initial state:", this.room.state);
        const plainState = this.convertToPlainObject(this.room.state);
        console.log("Plain initial state:", plainState);
        this.notifyStateChange(plainState);
      }

      // Set up message handlers
      this.room.onMessage("move_result", (message: any) => {
        console.log("Move result:", message);
      });

      this.room.onMessage("equip_result", (message: any) => {
        console.log("Equip result:", message);
        this.notifyEquipResult(message);
      });

      this.room.onMessage("unequip_result", (message: any) => {
        console.log("Unequip result:", message);
        this.notifyUnequipResult(message);
      });

      this.room.onMessage("combat_result", (message: any) => {
        console.log("Combat result:", message);
      });

      this.room.onMessage("spell_result", (message: any) => {
        console.log("Spell result:", message);
      });

      this.room.onMessage("pickup_result", (message: any) => {
        console.log("Pickup result:", message);
      });

      this.room.onMessage("drop_result", (message: any) => {
        console.log("Drop result:", message);
      });

      this.room.onMessage("error", (message: any) => {
        console.error("Server error:", message);
        this.notifyError(message);
      });

      this.room.onLeave((code: number) => {
        console.log("Left room:", code);
        this.room = null;
      });

      // Add catch-all message handler to see all messages
      this.room.onMessage("*", (type: any, message: any) => {
        console.log("Received message type:", type, "message:", message);
      });

      this.notifyConnect();
      return this.room;
    } catch (error) {
      console.error("Failed to join room:", error);
      this.notifyError(error);
      throw error;
    }
  }

  move(dx: number, dy: number) {
    console.log("GameClient.move called with:", dx, dy);
    if (this.room) {
      console.log("Sending move message to server");
      this.room.send("move", { dx, dy });
    } else {
      console.log("No room available for movement");
    }
  }

  attack(targetX: number, targetY: number) {
    if (this.room) {
      this.room.send("attack", { targetX, targetY });
    }
  }

  castSpell(spellName: string, targetX: number, targetY: number) {
    if (this.room) {
      this.room.send("cast_spell", { spellName, targetX, targetY });
    }
  }

  pickup() {
    if (this.room) {
      this.room.send("pickup", {});
    }
  }

  /**
   * Equip an item to a specific slot
   */
  equipItem(slotPath: string, itemName: string): void {
    if (!this.room) {
      console.error('Not connected to room');
      return;
    }
    this.room.send("equip", { slotPath, itemName });
  }

  unequipItem(slotPath: string): void {
    if (!this.room) {
      console.error('Not connected to room');
      return;
    }
    this.room.send("unequip", { slotPath });
  }

  dropItem(itemName: string) {
    if (this.room) {
      this.room.send("drop_item", { itemName });
    }
  }

  getCurrentState(): GameState | null {
    return this.room ? this.room.state : null;
  }

  isConnected(): boolean {
    return this.room !== null;
  }

  onStateChange(callback: (state: GameState) => void) {
    this.onStateChangeCallbacks.push(callback);
  }

  onError(callback: (error: any) => void) {
    this.onErrorCallbacks.push(callback);
  }

  onConnect(callback: () => void) {
    this.onConnectCallbacks.push(callback);
  }

  onEquipResult(callback: (result: any) => void) {
    this.onEquipResultCallbacks.push(callback);
  }

  onUnequipResult(callback: (result: any) => void) {
    this.onUnequipResultCallbacks.push(callback);
  }

  private convertToPlainObject(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    // Handle MapSchema (convert to plain Map)
    if (obj.$items && obj.$indexes) {
      const plainMap = new Map();
      obj.forEach((value: any, key: string) => {
        plainMap.set(key, this.convertToPlainObject(value));
      });
      return plainMap;
    }

    // Handle ArraySchema (convert to plain array)
    if (obj.items && typeof obj.items === 'object' && (
        obj.items.constructor.name.includes('ArraySchema') || 
        obj.constructor.name.includes('ArraySchema')
    )) {
      console.log("Converting ArraySchema to array, length:", obj.items.length);
      return Array.from(obj.items).map(item => this.convertToPlainObject(item));
    }

    // Handle ArraySchema by checking for ArraySchema-like properties
    if (obj.items && typeof obj.items === 'object' && typeof obj.items.length === 'number') {
      console.log("Converting ArraySchema-like object to array, length:", obj.items.length);
      return Array.from(obj.items).map(item => this.convertToPlainObject(item));
    }

    // Handle regular arrays
    if (Array.isArray(obj)) {
      return obj.map(item => this.convertToPlainObject(item));
    }

    // Handle Schema objects (convert to plain object)
    if (typeof obj === 'object' && obj.constructor && obj.constructor.name.includes('_')) {
      const plainObj: any = {};
      console.log("Converting Schema object:", obj.constructor.name, "keys:", Object.keys(obj));
      for (const key in obj) {
        if (!key.startsWith('~') && key !== 'constructor') {
          plainObj[key] = this.convertToPlainObject(obj[key]);
        }
      }
      return plainObj;
    }

    // Return primitive values as-is
    return obj;
  }

  private notifyStateChange(state: GameState) {
    this.onStateChangeCallbacks.forEach(callback => callback(state));
  }

  private notifyError(error: any) {
    this.onErrorCallbacks.forEach(callback => callback(error));
  }

  private notifyConnect() {
    this.onConnectCallbacks.forEach(callback => callback());
  }

  private notifyEquipResult(result: any) {
    this.onEquipResultCallbacks.forEach(callback => callback(result));
  }

  private notifyUnequipResult(result: any) {
    this.onUnequipResultCallbacks.forEach(callback => callback(result));
  }

  disconnect() {
    if (this.room) {
      this.room.leave();
      this.room = null;
    }
  }
}

// Singleton instance
export const gameClient = new GameClient();
