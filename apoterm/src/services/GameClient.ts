import { Client, Room } from "colyseus.js";
import { GAME_CONSTANTS } from "../../../shared/constants";

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
  private onLanguageDataInitCallbacks: ((data: any) => void)[] = [];
  private onLanguageSearchResultsCallbacks: ((results: any) => void)[] = [];
  private onLanguageEntryResultCallbacks: ((result: any) => void)[] = [];
  private onItemInspectCallbacks: ((result: any) => void)[] = [];
  private onAutoNavigateResultCallbacks: ((result: any) => void)[] = [];
  private onAutoNavigateStepCallbacks: ((step: any) => void)[] = [];
  private onAutoNavigateCompleteCallbacks: ((result: any) => void)[] = [];
  private onAutoNavigateStoppedCallbacks: ((result: any) => void)[] = [];
  private lastPlayerX: number | undefined;
  private lastPlayerY: number | undefined;

  constructor() {
    // Connect to Colyseus server (adjust port as needed)
    if (GAME_CONSTANTS.DEBUG) console.log("Creating GameClient, connecting to ws://localhost:2567");
    this.client = new Client("ws://localhost:2567");
  }

  async joinRoom(roomName: string = "my_room", options: any = {}) {
    try {
      if (GAME_CONSTANTS.DEBUG) console.log(`Attempting to join room: ${roomName}`, options);
      this.room = await this.client.joinOrCreate(roomName, options);
      
      if (GAME_CONSTANTS.DEBUG) console.log("Successfully joined room!");
      
      // Set up state change listener
      this.room.onStateChange((state: any) => {
        if (GAME_CONSTANTS.DEBUG) console.log("State changed:", state);
        // Convert Colyseus Schema objects to plain objects
        const plainState = this.convertToPlainObject(state);
        if (GAME_CONSTANTS.DEBUG) console.log("Plain state:", plainState);
        if (GAME_CONSTANTS.DEBUG) console.log("Player position in state:", plainState.player?.x, plainState.player?.y);
        if (GAME_CONSTANTS.DEBUG) console.log("Full player object:", plainState.player);
        
        // Check if this is actually a different state
        if (this.lastPlayerX !== plainState.player?.x || this.lastPlayerY !== plainState.player?.y) {
          if (GAME_CONSTANTS.DEBUG) console.log("PLAYER POSITION CHANGED from", this.lastPlayerX, this.lastPlayerY, "to", plainState.player?.x, plainState.player?.y);
        }
        this.lastPlayerX = plainState.player?.x;
        this.lastPlayerY = plainState.player?.y;
        
        this.notifyStateChange(plainState);
      });

      // Get initial state
      if (this.room.state) {
        if (GAME_CONSTANTS.DEBUG) console.log("Initial state:", this.room.state);
        const plainState = this.convertToPlainObject(this.room.state);
        if (GAME_CONSTANTS.DEBUG) console.log("Plain initial state:", plainState);
        this.notifyStateChange(plainState);
      }

      // Set up message handlers
      this.room.onMessage("move_result", (message: any) => {
        if (GAME_CONSTANTS.DEBUG) console.log("Move result:", message);
      });

      this.room.onMessage("equip_result", (message: any) => {
        if (GAME_CONSTANTS.DEBUG) console.log("Equip result:", message);
        this.notifyEquipResult(message);
      });

      this.room.onMessage("unequip_result", (message: any) => {
        if (GAME_CONSTANTS.DEBUG) console.log("Unequip result:", message);
        this.notifyUnequipResult(message);
      });

      this.room.onMessage("combat_result", (message: any) => {
        if (GAME_CONSTANTS.DEBUG) console.log("Combat result:", message);
      });

      this.room.onMessage("spell_result", (message: any) => {
        if (GAME_CONSTANTS.DEBUG) console.log("Spell result:", message);
      });

      this.room.onMessage("pickup_result", (message: any) => {
        if (GAME_CONSTANTS.DEBUG) console.log("Pickup result:", message);
      });

      this.room.onMessage("spacebar_attack_result", (message: any) => {
        if (GAME_CONSTANTS.DEBUG) console.log("Spacebar attack result:", message);
      });

      this.room.onMessage("drop_result", (message: any) => {
        if (GAME_CONSTANTS.DEBUG) console.log("Drop result:", message);
      });

      this.room.onMessage("error", (message: any) => {
        console.error("Server error:", message);
        this.notifyError(message);
      });

      // Language data handlers
      this.room.onMessage("language_data_init", (message: any) => {
        if (GAME_CONSTANTS.DEBUG) console.log("Language data initialized:", message.totalEntries, "entries");
        this.notifyLanguageDataInit(message);
      });

      this.room.onMessage("language_search_results", (message: any) => {
        if (GAME_CONSTANTS.DEBUG) console.log("Language search results:", message.results);
        this.notifyLanguageSearchResults(message);
      });

      this.room.onMessage("language_entry_result", (message: any) => {
        if (GAME_CONSTANTS.DEBUG) console.log("Language entry result:", message.entry);
        this.notifyLanguageEntryResult(message);
      });

      // Autonavigation handlers
      this.room.onMessage("auto_navigate_result", (message: any) => {
        if (GAME_CONSTANTS.DEBUG) console.log("Auto navigate result:", message);
        this.notifyAutoNavigateResult(message);
      });

      this.room.onMessage("auto_navigate_step", (message: any) => {
        if (GAME_CONSTANTS.DEBUG) console.log("Auto navigate step:", message);
        this.notifyAutoNavigateStep(message);
      });

      this.room.onMessage("auto_navigate_complete", (message: any) => {
        if (GAME_CONSTANTS.DEBUG) console.log("Auto navigate complete:", message);
        this.notifyAutoNavigateComplete(message);
      });

      this.room.onMessage("auto_navigate_stopped", (message: any) => {
        if (GAME_CONSTANTS.DEBUG) console.log("Auto navigate stopped:", message);
        this.notifyAutoNavigateStopped(message);
      });

      this.room.onLeave((code: number) => {
        if (GAME_CONSTANTS.DEBUG) console.log("Left room:", code);
        this.room = null;
      });

      // Add catch-all message handler to see all messages
      this.room.onMessage("*", (type: any, message: any) => {
        if (GAME_CONSTANTS.DEBUG) console.log("Received message type:", type, "message:", message);
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
    if (GAME_CONSTANTS.DEBUG) console.log("GameClient.move called with:", dx, dy);
    if (this.room) {
      if (GAME_CONSTANTS.DEBUG) console.log("Sending move message to server");
      this.room.send("move", { dx, dy });
    } else {
      if (GAME_CONSTANTS.DEBUG) console.log("No room available for movement");
    }
  }

  /**
   * Melee/AoE attack around the player (spacebar-style)
   */
  meleeAttack() {
    if (this.room) {
      console.log("Sending melee attack (move with attack flag)");
      this.room.send("move", { dx: 0, dy: 0, attack: true });
    } else {
      console.log("No room available for melee attack");
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

  // Language data methods
  searchLanguage(query: string) {
    if (this.room) {
      this.room.send("search_language", { query });
    }
  }

  getLanguageEntry(key: string) {
    if (this.room) {
      this.room.send("get_language_entry", { key });
    }
  }

  // Save/Load functionality
  saveGame() {
    if (this.room) {
      this.room.send("save_game", {});
    }
  }

  loadGame() {
    if (this.room) {
      this.room.send("load_game", {});
    }
  }

  // Autonavigation methods
  autoNavigate(targetX: number, targetY: number, moveInterval: number = 1000) {
    if (GAME_CONSTANTS.DEBUG) console.log(`[DEBUG] GameClient.autoNavigate called with target (${targetX}, ${targetY}), interval: ${moveInterval}`);
    if (GAME_CONSTANTS.DEBUG) console.log(`[DEBUG] Room available:`, !!this.room);
    
    if (this.room) {
      if (GAME_CONSTANTS.DEBUG) console.log(`[DEBUG] Sending auto_navigate message to server`);
      this.room.send("auto_navigate", { targetX, targetY, moveInterval });
      if (GAME_CONSTANTS.DEBUG) console.log(`[DEBUG] auto_navigate message sent`);
    } else {
      if (GAME_CONSTANTS.DEBUG) console.log(`[DEBUG] No room available for autonavigation`);
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

  onLanguageDataInit(callback: (data: any) => void) {
    this.onLanguageDataInitCallbacks.push(callback);
  }

  onLanguageSearchResults(callback: (results: any) => void) {
    this.onLanguageSearchResultsCallbacks.push(callback);
  }

  onLanguageEntryResult(callback: (result: any) => void) {
    this.onLanguageEntryResultCallbacks.push(callback);
  }

  onItemInspect(callback: (result: any) => void) {
    this.onItemInspectCallbacks.push(callback);
  }

  onAutoNavigateResult(callback: (result: any) => void) {
    this.onAutoNavigateResultCallbacks.push(callback);
  }

  onAutoNavigateStep(callback: (step: any) => void) {
    this.onAutoNavigateStepCallbacks.push(callback);
  }

  onAutoNavigateComplete(callback: (result: any) => void) {
    this.onAutoNavigateCompleteCallbacks.push(callback);
  }

  onAutoNavigateStopped(callback: (result: any) => void) {
    this.onAutoNavigateStoppedCallbacks.push(callback);
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
      if (GAME_CONSTANTS.DEBUG) console.log("Converting ArraySchema to array, length:", obj.items.length);
      return Array.from(obj.items).map(item => this.convertToPlainObject(item));
    }

    // Handle ArraySchema by checking for ArraySchema-like properties
    if (obj.items && typeof obj.items === 'object' && typeof obj.items.length === 'number') {
      if (GAME_CONSTANTS.DEBUG) console.log("Converting ArraySchema-like object to array, length:", obj.items.length);
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

  private notifyLanguageDataInit(data: any) {
    this.onLanguageDataInitCallbacks.forEach(callback => callback(data));
  }

  private notifyLanguageSearchResults(results: any) {
    this.onLanguageSearchResultsCallbacks.forEach(callback => callback(results));
  }

  private notifyLanguageEntryResult(result: any) {
    this.onLanguageEntryResultCallbacks.forEach(callback => callback(result));
  }

  private notifyItemInspect(result: any) {
    this.onItemInspectCallbacks.forEach(callback => callback(result));
  }

  private notifyAutoNavigateResult(result: any) {
    this.onAutoNavigateResultCallbacks.forEach(callback => callback(result));
  }

  private notifyAutoNavigateStep(step: any) {
    this.onAutoNavigateStepCallbacks.forEach(callback => callback(step));
  }

  private notifyAutoNavigateComplete(result: any) {
    this.onAutoNavigateCompleteCallbacks.forEach(callback => callback(result));
  }

  private notifyAutoNavigateStopped(result: any) {
    this.onAutoNavigateStoppedCallbacks.forEach(callback => callback(result));
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
