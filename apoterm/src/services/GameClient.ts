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

      this.room.onMessage("equip_result", (message: any) => {
        console.log("Equip result:", message);
      });

      this.room.onMessage("unequip_result", (message: any) => {
        console.log("Unequip result:", message);
      });

      this.room.onMessage("error", (message: any) => {
        console.error("Server error:", message);
        this.notifyError(message);
      });

      this.room.onLeave((code: number) => {
        console.log("Left room:", code);
        this.room = null;
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
    if (this.room) {
      this.room.send("move", { dx, dy });
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

  /**
   * Unequip an item from a slot
   */
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
    if (Array.isArray(obj)) {
      return obj.map(item => this.convertToPlainObject(item));
    }

    // Handle Schema objects (convert to plain object)
    if (typeof obj === 'object' && obj.constructor && obj.constructor.name.includes('_')) {
      const plainObj: any = {};
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

  disconnect() {
    if (this.room) {
      this.room.leave();
      this.room = null;
    }
  }
}

// Singleton instance
export const gameClient = new GameClient();
