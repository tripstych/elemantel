import { GameState } from "../schema/GameState";
import { PlayerState } from "../schema/PlayerState";
import { PathfinderCommand, Position } from "./PathfinderCommand";
import { VectorEngineCommand, CastResult, ItemData } from "./VectorEngineCommand";

export interface MoveResult {
  success: boolean;
  reason?: string;
  new_position?: { x: number; y: number };
  old_position?: { x: number; y: number };
}

export interface SpellResult {
  success: boolean;
  message: string;
  effects?: any[];
  castResult?: CastResult;
}

export class PlayerCommands {
  /**
   * Attempt to move the player by dx, dy
   */
  static handleMove(gameState: GameState, dx: number, dy: number): MoveResult {
    const player = gameState.player;
    if (!player) {
      return { success: false, reason: "No player found" };
    }

    const oldX = player.x;
    const oldY = player.y;
    const newX = oldX + dx;
    const newY = oldY + dy;

    // Check bounds
    if (!this.isInBounds(newX, newY, gameState)) {
      return { success: false, reason: "Out of bounds" };
    }

    // Check collision
    const tile = this.getTile(newX, newY, gameState);
    const wallTile = gameState.map.tile_constants.get("WALL") ?? 1;
    
    if (tile === wallTile) {
      return { success: false, reason: "Blocked by wall" };
    }

    // Check if occupied by entity
    if (this.isPositionOccupied(newX, newY, gameState)) {
      return { success: false, reason: "Position occupied" };
    }

    // Move player
    player.x = newX;
    player.y = newY;

    return {
      success: true,
      new_position: { x: newX, y: newY },
      old_position: { x: oldX, y: oldY }
    };
  }

  /**
   * Check if player is armed (has items in hand slots)
   */
  static isArmed(player: any): boolean {
    if (!player.slots || !player.slots.hand_slots) return false;
    return player.slots.hand_slots.main_hand !== "" || player.slots.hand_slots.off_hand !== "";
  }

  /**
   * Check if player is adorned (has items in body slots)
   */
  static isAdorned(player: any): boolean {
    if (!player.slots || !player.slots.body_slots) return false;
    const bodySlots = player.slots.body_slots;
    return Object.values(bodySlots).some((slot: any) => slot !== "");
  }

  /**
   * Equip an item to a specific slot
   */
  static equipItem(player: any, slotPath: string, itemName: string): { success: boolean; message: string } {
    if (!player.slots) {
      return { success: false, message: "Player has no slots" };
    }

    // Navigate to the slot using dot notation (e.g., "hand_slots.main_hand")
    const slotParts = slotPath.split('.');
    let current = player.slots;
    
    for (let i = 0; i < slotParts.length - 1; i++) {
      current = current[slotParts[i]];
      if (!current) {
        return { success: false, message: `Invalid slot path: ${slotPath}` };
      }
    }

    const finalSlot = slotParts[slotParts.length - 1];
    if (current[finalSlot] === undefined) {
      return { success: false, message: `Invalid slot: ${finalSlot}` };
    }

    // Check if item is in inventory
    const itemIndex = player.inventory.indexOf(itemName);
    if (itemIndex === -1) {
      return { success: false, message: `Item ${itemName} not found in inventory` };
    }

    // Remove from inventory and equip
    player.inventory.splice(itemIndex, 1);
    current[finalSlot] = itemName;
    
    return { success: true, message: `Equipped ${itemName} to ${slotPath}` };
  }

  /**
   * Unequip an item from a slot
   */
  static unequipItem(player: any, slotPath: string): { success: boolean; message: string; item?: string } {
    if (!player.slots) {
      return { success: false, message: "Player has no slots" };
    }

    // Navigate to the slot
    const slotParts = slotPath.split('.');
    let current = player.slots;
    
    for (let i = 0; i < slotParts.length - 1; i++) {
      current = current[slotParts[i]];
      if (!current) {
        return { success: false, message: `Invalid slot path: ${slotPath}` };
      }
    }

    const finalSlot = slotParts[slotParts.length - 1];
    if (current[finalSlot] === undefined) {
      return { success: false, message: `Invalid slot: ${finalSlot}` };
    }

    const itemName = current[finalSlot];
    if (itemName === "") {
      return { success: false, message: `Slot ${slotPath} is empty` };
    }

    // Remove from slot and add to inventory
    current[finalSlot] = "";
    player.inventory.push(itemName);
    
    return { success: true, message: `Unequipped ${itemName} from ${slotPath}`, item: itemName };
  }

  /**
   * Handle spell casting using VectorEngine
   */
  static handleSpell(
    gameState: GameState, 
    syllables: string[],
    targetItem?: ItemData,
    casterConduit?: number,
    casterHp?: number
  ): SpellResult {
    if (!syllables || syllables.length === 0) {
      return { success: false, message: "No spell syllables provided" };
    }

    // Create default VectorEngine with sample syllables
    const vectorEngine = VectorEngineCommand.createDefault();
    
    const phrase = syllables.join(" ");
    
    // Default values if not provided
    const item = targetItem || { weight: 1.0 };
    const conduit = casterConduit || 10;
    const hp = casterHp || 100;
    
    const castResult: CastResult = vectorEngine.cast(phrase, item, conduit, hp);
    
    return {
      success: castResult.success,
      message: castResult.message,
      castResult: castResult,
      effects: [{
        type: "elemental",
        vectors: castResult.vectors,
        strain: castResult.strain,
        load: castResult.load,
        burnDamage: castResult.burnDamage
      }]
    };
  }

  /**
   * Parse a phrase into elemental vectors without casting
   */
  static parseSpellPhrase(syllables: string[]) {
    if (!syllables || syllables.length === 0) {
      return null;
    }

    const vectorEngine = VectorEngineCommand.createDefault();
    const phrase = syllables.join(" ");
    
    return vectorEngine.parsePhrase(phrase);
  }

  /**
   * Suggest a spell phrase for target elemental effects
   */
  static suggestSpellPhrase(targetVectors: Partial<{ fire: number; water: number; earth: number; air: number }>, maxStrain?: number): string {
    const vectorEngine = VectorEngineCommand.createDefault();
    return vectorEngine.suggestPhrase(targetVectors, maxStrain);
  }

  /**
   * Check if coordinates are within map bounds
   */
  private static isInBounds(x: number, y: number, gameState: GameState): boolean {
    return x >= 0 && y >= 0 && x < gameState.map.width && y < gameState.map.height;
  }

  /**
   * Get tile type at coordinates
   */
  private static getTile(x: number, y: number, gameState: GameState): number {
    const tileRow = gameState.map.tiles[y];
    if (!tileRow) return 1; // Default to wall
    
    return tileRow.values[x] ?? 1; // Default to wall
  }

  /**
   * Check if a position is occupied by any entity
   */
  private static isPositionOccupied(x: number, y: number, gameState: GameState): boolean {
    // Check if any monster is at this position
    for (const entity of gameState.entities) {
      if (entity.x === x && entity.y === y) {
        return true;
      }
    }
    
    // Note: We don't check player position since this is used for player movement
    return false;
  }

  /**
   * Find path from start to goal using A* pathfinding
   */
  static findPath(
    gameState: GameState,
    start: Position,
    goal: Position,
    options?: {
      allowDiagonal?: boolean;
      walkableTiles?: Set<number>;
    }
  ): Position[] | null {
    return PathfinderCommand.astar(gameState, start, goal, options);
  }

  /**
   * Get all valid moves from a position using pathfinding
   */
  static getValidMoves(gameState: GameState, fromX: number, fromY: number): { x: number; y: number }[] {
    const start = { x: fromX, y: fromY };
    const walkableTiles = new Set([0, 1, 2, 3, 4, 5, 6]); // Default walkable tiles
    
    const neighbors = PathfinderCommand.getNeighbors(
      gameState.map,
      start,
      false, // No diagonal by default
      walkableTiles
    );
    
    return neighbors;
  }

  /**
   * Check if there's a clear path between two positions
   */
  static hasClearPath(
    gameState: GameState,
    start: Position,
    goal: Position,
    options?: {
      allowDiagonal?: boolean;
      walkableTiles?: Set<number>;
    }
  ): boolean {
    const path = PathfinderCommand.astar(gameState, start, goal, options);
    return path !== null && path.length > 0;
  }

  /**
   * Get distance between two positions using pathfinding
   */
  static getPathDistance(
    gameState: GameState,
    start: Position,
    goal: Position,
    options?: {
      allowDiagonal?: boolean;
      walkableTiles?: Set<number>;
    }
  ): number {
    const path = PathfinderCommand.astar(gameState, start, goal, options);
    if (!path) return Infinity;
    
    let distance = 0;
    for (let i = 1; i < path.length; i++) {
      const dx = Math.abs(path[i].x - path[i-1].x);
      const dy = Math.abs(path[i].y - path[i-1].y);
      distance += (dx === 1 && dy === 1) ? Math.sqrt(2) : 1;
    }
    
    return distance;
  }

  /**
   * Calculate Manhattan distance between two positions
   */
  static manhattanDistance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
  }

  /**
   * Calculate Euclidean distance between two positions
   */
  static euclideanDistance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  }

  /**
   * Get direction name from movement delta
   */
  static getDirectionName(dx: number, dy: number): string {
    if (dx === 0 && dy === -1) return "north";
    if (dx === 1 && dy === 0) return "east";
    if (dx === 0 && dy === 1) return "south";
    if (dx === -1 && dy === 0) return "west";
    if (dx === 1 && dy === -1) return "northeast";
    if (dx === 1 && dy === 1) return "southeast";
    if (dx === -1 && dy === 1) return "southwest";
    if (dx === -1 && dy === -1) return "northwest";
    return "unknown";
  }
}