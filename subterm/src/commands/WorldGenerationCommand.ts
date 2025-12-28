import { send, ClientMessages } from "../utils/ClientSend";
import { GameState } from "../schema/GameState";
import { GameMap, TileRow } from "../schema/GameMap";
import { PlayerState } from "../schema/PlayerState";
import { MonsterState } from "../schema/MonsterState";
import { Weapon, DamageType } from "../schema/Equipment";
import { Item } from "../schema/Item";
import { ArraySchema, MapSchema } from "@colyseus/schema";
import { LanguageData, WeaponEffect } from "../schema/LanguageData";

export interface Position {
  x: number;
  y: number;
}

export interface WorldGenerationOptions {
  seed?: number;
  width?: number;
  height?: number;
  algorithm?: 'bsp' | 'cellular' | 'drunkard' | 'rooms_corridors';
}

export class WorldGenerationCommand {
  // Tile type constants (matching Python version)
  private static readonly TILE_TYPES = {
    FLOOR: 0,
    WALL: 1,
    DOOR: 2,
    CORRIDOR: 3,
    ROOM_FLOOR: 4,
    ENTRANCE: 5,
    EXIT: 6
  };

  /**
   * Initialize a new game world with BSP dungeon generation
   * Returns plain data that can be safely copied to room state
   */
  static initializeWorld(options: WorldGenerationOptions = {}): any {
    const {
      seed = 42,
      width = 60,
      height = 30,
      algorithm = 'bsp'
    } = options;

    // Set random seed for reproducibility
    const rng = this.createSeededRNG(seed);

    // Generate dungeon using BSP algorithm
    const mapData = this.generateBSPDungeon(width, height, rng);
    
    // Create plain data object instead of schema instances
    const gameState = {
      map: {
        width: mapData.width,
        height: mapData.height,
        tiles: [],
        entrance: { x: mapData.entrance.x, y: mapData.entrance.y },
        exit: { x: mapData.exit.x, y: mapData.exit.y }
      },
      player: {
        name: "Player",
        x: 0,
        y: 0,
        hp: 100,
        max_hp: 100,
        mana: 50,
        strength: 14,
        dexterity: 12,
        constitution: 13,
        intelligence: 10,
        wisdom: 12,
        charisma: 10,
        armor_class: 10,
        speed: 30,
        proficiency_bonus: 2,
        inventory: []
      },
      entities: [],
      world: {}
    };

    // Convert tiles to plain arrays
    for (let y = 0; y < mapData.tiles.length; y++) {
      const row = [];
      for (let x = 0; x < mapData.tiles[y].values.length; x++) {
        row.push(mapData.tiles[y].values[x]);
      }
      gameState.map.tiles.push(row);
    }

    // Place player at entrance or first walkable tile
    const playerPos = this.findPlayerSpawn(mapData);
    gameState.player.x = playerPos.x;
    gameState.player.y = playerPos.y;

    // Spawn initial monsters
    this.spawnInitialMonstersPlain(gameState, mapData, rng);

    // Add starter items to player inventory
    this.addStarterItemsPlain(gameState.player);

    // Scatter items throughout the world
    this.scatterItemsPlain(gameState, mapData, rng);

    return gameState;
  }

  /**
   * Create a seeded random number generator
   */
  private static createSeededRNG(seed: number): () => number {
    let state = seed;
    return () => {
      state = (state * 9301 + 49297) % 233280;
      return state / 233280;
    };
  }

  /**
   * Generate dungeon using BSP (Binary Space Partitioning) algorithm
   */
  private static generateBSPDungeon(width: number, height: number, rng: () => number): GameMap {
    const map = new GameMap();
    map.width = width;
    map.height = height;
    
    // Initialize with walls using proper Colyseus ArraySchema
    map.tiles = new ArraySchema<TileRow>();
    for (let y = 0; y < height; y++) {
      const row = new TileRow();
      row.values = new ArraySchema<number>();
      for (let x = 0; x < width; x++) {
        row.values.push(this.TILE_TYPES.WALL);
      }
      map.tiles.push(row);
    }
    
    // Simple BSP implementation
    const rooms = this.generateBSPRooms(width, height, rng, 5, 3); // min size 5x5, max splits 3
    
    // Carve out rooms
    for (const room of rooms) {
      for (let y = room.y; y < room.y + room.height; y++) {
        for (let x = room.x; x < room.x + room.width; x++) {
          if (x < width && y < height && map.tiles[y] && map.tiles[y].values) {
            map.tiles[y].values[x] = this.TILE_TYPES.ROOM_FLOOR;
          }
        }
      }
    }

    // Connect rooms with corridors
    this.connectRooms(map, rooms, rng);

    // Add entrance and exit
    if (rooms.length > 0) {
      const firstRoom = rooms[0];
      const lastRoom = rooms[rooms.length - 1];
      
      // Entrance in first room
      const entranceX = Math.floor(firstRoom.x + firstRoom.width / 2);
      const entranceY = Math.floor(firstRoom.y + firstRoom.height / 2);
      if (map.tiles[entranceY] && map.tiles[entranceY].values) {
        map.tiles[entranceY].values[entranceX] = this.TILE_TYPES.ENTRANCE;
      }
      
      // Exit in last room
      const exitX = Math.floor(lastRoom.x + lastRoom.width / 2);
      const exitY = Math.floor(lastRoom.y + lastRoom.height / 2);
      if (map.tiles[exitY] && map.tiles[exitY].values) {
        map.tiles[exitY].values[exitX] = this.TILE_TYPES.EXIT;
      }
    }

    return map;
  }

  /**
   * Generate rooms using BSP
   */
  private static generateBSPRooms(
    width: number, 
    height: number, 
    rng: () => number,
    minSize: number,
    maxSplits: number
  ): Array<{x: number, y: number, width: number, height: number}> {
    const rooms: Array<{x: number, y: number, width: number, height: number}> = [];
    
    const split = (x: number, y: number, w: number, h: number, depth: number) => {
      if (depth >= maxSplits || w < minSize * 2 || h < minSize * 2) {
        // Add room
        const roomW = Math.max(minSize, Math.floor(w * 0.8));
        const roomH = Math.max(minSize, Math.floor(h * 0.8));
        const roomX = x + Math.floor((w - roomW) / 2);
        const roomY = y + Math.floor((h - roomH) / 2);
        rooms.push({ x: roomX, y: roomY, width: roomW, height: roomH });
        return;
      }

      // Decide split direction
      const horizontal = w > h || (w === h && rng() > 0.5);
      
      if (horizontal) {
        // Split vertically
        const splitX = x + minSize + Math.floor((w - minSize * 2) * rng());
        split(x, y, splitX - x, h, depth + 1);
        split(splitX, y, x + w - splitX, h, depth + 1);
      } else {
        // Split horizontally
        const splitY = y + minSize + Math.floor((h - minSize * 2) * rng());
        split(x, y, w, splitY - y, depth + 1);
        split(x, splitY, w, y + h - splitY, depth + 1);
      }
    };

    split(0, 0, width, height, 0);
    return rooms;
  }

  /**
   * Connect rooms with corridors
   */
  private static connectRooms(
    map: GameMap, 
    rooms: Array<{x: number, y: number, width: number, height: number}>,
    rng: () => number
  ): void {
    for (let i = 0; i < rooms.length - 1; i++) {
      const room1 = rooms[i];
      const room2 = rooms[i + 1];
      
      // Connect room centers
      const x1 = Math.floor(room1.x + room1.width / 2);
      const y1 = Math.floor(room1.y + room1.height / 2);
      const x2 = Math.floor(room2.x + room2.width / 2);
      const y2 = Math.floor(room2.y + room2.height / 2);
      
      // Create L-shaped corridor
      if (rng() > 0.5) {
        // Horizontal first, then vertical
        this.drawCorridor(map, x1, y1, x2, y1);
        this.drawCorridor(map, x2, y1, x2, y2);
      } else {
        // Vertical first, then horizontal
        this.drawCorridor(map, x1, y1, x1, y2);
        this.drawCorridor(map, x1, y2, x2, y2);
      }
    }
  }

  /**
   * Draw a corridor between two points
   */
  private static drawCorridor(map: GameMap, x1: number, y1: number, x2: number, y2: number): void {
    if (x1 === x2) {
      // Vertical corridor
      const minY = Math.min(y1, y2);
      const maxY = Math.max(y1, y2);
      for (let y = minY; y <= maxY; y++) {
        if (y >= 0 && y < map.height && x1 >= 0 && x1 < map.width && map.tiles[y] && map.tiles[y].values) {
          if (map.tiles[y].values[x1] === this.TILE_TYPES.WALL) {
            map.tiles[y].values[x1] = this.TILE_TYPES.CORRIDOR;
          }
        }
      }
    } else if (y1 === y2) {
      // Horizontal corridor
      const minX = Math.min(x1, x2);
      const maxX = Math.max(x1, x2);
      for (let x = minX; x <= maxX; x++) {
        if (y1 >= 0 && y1 < map.height && x >= 0 && x < map.width && map.tiles[y1] && map.tiles[y1].values) {
          if (map.tiles[y1].values[x] === this.TILE_TYPES.WALL) {
            map.tiles[y1].values[x] = this.TILE_TYPES.CORRIDOR;
          }
        }
      }
    }
  }

  /**
   * Find player spawn position (entrance or first walkable tile)
   */
  private static findPlayerSpawn(map: GameMap): Position {
    // Look for entrance first
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (map.tiles[y] && map.tiles[y].values && map.tiles[y].values[x] === this.TILE_TYPES.ENTRANCE) {
          return { x, y };
        }
      }
    }

    // Fallback to first walkable tile
    const walkableTiles = new Set([
      this.TILE_TYPES.FLOOR,
      this.TILE_TYPES.ROOM_FLOOR,
      this.TILE_TYPES.CORRIDOR,
      this.TILE_TYPES.ENTRANCE,
      this.TILE_TYPES.EXIT
    ]);

    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (map.tiles[y] && map.tiles[y].values && walkableTiles.has(map.tiles[y].values[x])) {
          return { x, y };
        }
      }
    }

    // Ultimate fallback
    return { x: 1, y: 1 };
  }

  /**
   * Initialize player stats
   */
  private static initializePlayerStats(player: PlayerState): void {
    player.name = "Player";
    player.hp = 100;
    player.max_hp = 100;
    player.mana = 50;
    player.strength = 14;
    player.dexterity = 12;
    player.constitution = 13;
    player.intelligence = 10;
    player.wisdom = 12;
    player.charisma = 10;
    player.armor_class = 10;
    player.proficiency_bonus = 2;
  }

  /**
   * Spawn initial monsters near player
   */
  private static spawnInitialMonsters(gameState: GameState, rng: () => number): void {
    const candidateOffsets = [
      { dx: 2, dy: 0 }, { dx: -2, dy: 0 }, { dx: 0, dy: 2 }, { dx: 0, dy: -2 },
      { dx: 2, dy: 2 }, { dx: -2, dy: 2 }, { dx: 2, dy: -2 }, { dx: -2, dy: -2 }
    ];

    const walkableTiles = new Set([
      this.TILE_TYPES.FLOOR,
      this.TILE_TYPES.ROOM_FLOOR,
      this.TILE_TYPES.CORRIDOR
    ]);

    const monsterTypes = ['goblin', 'slime', 'orc'];
    let monsterId = 1;

    for (const offset of candidateOffsets) {
      if (monsterId > 3) break; // Limit initial monsters

      const mx = gameState.player.x + offset.dx;
      const my = gameState.player.y + offset.dy;

      if (mx >= 0 && mx < gameState.map.width && 
          my >= 0 && my < gameState.map.height &&
          gameState.map.tiles[my] && gameState.map.tiles[my].values &&
          walkableTiles.has(gameState.map.tiles[my].values[mx])) {
        
        const monster = new MonsterState();
        monster.id = monsterId++;
        monster.kind = monsterTypes[Math.floor(rng() * monsterTypes.length)];
        monster.x = mx;
        monster.y = my;
        monster.hp = 20;
        // Note: max_hp property doesn't exist in MonsterState schema

        gameState.entities.push(monster);
      }
    }
  }

  /**
   * Add starter items to player inventory
   */
  private static addStarterItems(player: PlayerState): void {
    // Create starter weapons
    const shortsword = new Weapon();
    shortsword.name = "Shortsword";
    shortsword.damage_dice = "1d6";
    shortsword.damage_type = "piercing" as DamageType;
    shortsword.properties = new ArraySchema<string>("finesse");
    shortsword.range = 5;

    const shortbow = new Weapon();
    shortbow.name = "Shortbow";
    shortbow.damage_dice = "1d6";
    shortbow.damage_type = "piercing" as DamageType;
    shortbow.properties = new ArraySchema<string>("ranged");
    shortbow.range = 60;

    // Add to inventory as strings (PlayerState inventory expects strings)
    player.inventory.push(shortsword.name);
    player.inventory.push(shortbow.name);
  }

  /**
   * Scatter items throughout the world
   */
  private static scatterItems(gameState: GameState, rng: () => number): void {
    const walkableTiles = new Set([
      this.TILE_TYPES.FLOOR,
      this.TILE_TYPES.ROOM_FLOOR,
      this.TILE_TYPES.CORRIDOR,
      this.TILE_TYPES.DOOR,
      this.TILE_TYPES.ENTRANCE,
      this.TILE_TYPES.EXIT
    ]);

    // Initialize world items if not present
    if (!gameState.world) {
      gameState.world = new MapSchema<ArraySchema<Item>>();
    }

    const items = gameState.world;
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
      if (!items.has(key)) {
        items.set(key, new ArraySchema<Item>());
      }
      
      const item = new Item();
      item.name = itemData.name;
      item.type = itemData.type;
      items.get(key)!.push(item);
    };

    // Scatter items near player
    const nearCount = 4;
    const offsets = [
      { dx: -2, dy: -2 }, { dx: 2, dy: -2 }, { dx: -2, dy: 2 }, { dx: 2, dy: 2 },
      { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 0, dy: -1 }
    ];

    // Shuffle offsets
    for (let i = offsets.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [offsets[i], offsets[j]] = [offsets[j], offsets[i]];
    }

    let placed = 0;
    for (const offset of offsets) {
      if (placed >= nearCount) break;

      const x = gameState.player.x + offset.dx;
      const y = gameState.player.y + offset.dy;

      if (x >= 0 && x < gameState.map.width && 
          y >= 0 && y < gameState.map.height &&
          gameState.map.tiles[y] && gameState.map.tiles[y].values &&
          walkableTiles.has(gameState.map.tiles[y].values[x])) {
        
        // Add 1-3 items
        const itemCount = 1 + Math.floor(rng() * 3);
        for (let i = 0; i < itemCount; i++) {
          addItem(x, y, catalog[Math.floor(rng() * catalog.length)]);
        }
        placed++;
      }
    }

    // Scatter random items throughout the map
    const randomCount = 20;
    const walkablePositions: Position[] = [];

    for (let y = 0; y < gameState.map.height; y++) {
      for (let x = 0; x < gameState.map.width; x++) {
        if (gameState.map.tiles[y] && gameState.map.tiles[y].values &&
            walkableTiles.has(gameState.map.tiles[y].values[x]) &&
            !(x === gameState.player.x && y === gameState.player.y)) {
          walkablePositions.push({ x, y });
        }
      }
    }

    // Shuffle positions
    for (let i = walkablePositions.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [walkablePositions[i], walkablePositions[j]] = [walkablePositions[j], walkablePositions[i]];
    }

    for (let i = 0; i < Math.min(randomCount, walkablePositions.length); i++) {
      const pos = walkablePositions[i];
      const itemCount = 1 + Math.floor(rng() * 2);
      
      for (let j = 0; j < itemCount; j++) {
        addItem(pos.x, pos.y, catalog[Math.floor(rng() * catalog.length)]);
      }
    }
  }

  /**
   * Spawn enemies with weapon effects from LanguageData
   */
  static spawnEnemiesWithWeapons(
    gameState: GameState, 
    languageData: LanguageData, 
    rng: () => number,
    count: number = 3
  ): void {
    const candidateOffsets = [
      { dx: 3, dy: 0 }, { dx: -3, dy: 0 }, { dx: 0, dy: 3 }, { dx: 0, dy: -3 },
      { dx: 3, dy: 3 }, { dx: -3, dy: 3 }, { dx: 3, dy: -3 }, { dx: -3, dy: -2 },
      { dx: 4, dy: 0 }, { dx: -4, dy: 0 }, { dx: 0, dy: 4 }, { dx: 0, dy: -4 }
    ];

    const walkableTiles = new Set([
      this.TILE_TYPES.FLOOR,
      this.TILE_TYPES.ROOM_FLOOR,
      this.TILE_TYPES.CORRIDOR
    ]);

    const enemyTypes = [
      { kind: 'goblin', hp: 15, weaponKeys: ['dagger.n.01'] },
      { kind: 'orc', hp: 25, weaponKeys: ['scimitar.n.01', 'axe.n.01'] },
      { kind: 'slime', hp: 10, weaponKeys: [] }, // Unarmed enemy
      { kind: 'skeleton', hp: 20, weaponKeys: ['shortsword.n.01'] },
      { kind: 'goblin_archer', hp: 15, weaponKeys: ['shortbow.n.01'] }
    ];

    let enemyId = 1;

    // Shuffle offsets for variety
    for (let i = candidateOffsets.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [candidateOffsets[i], candidateOffsets[j]] = [candidateOffsets[j], candidateOffsets[i]];
    }

    for (const offset of candidateOffsets) {
      if (enemyId > count) break;

      const ex = gameState.player.x + offset.dx;
      const ey = gameState.player.y + offset.dy;

      if (ex >= 0 && ex < gameState.map.width && 
          ey >= 0 && ey < gameState.map.height &&
          gameState.map.tiles[ey] && gameState.map.tiles[ey].values &&
          walkableTiles.has(gameState.map.tiles[ey].values[ex])) {
        
        // Select enemy type
        const enemyType = enemyTypes[Math.floor(rng() * enemyTypes.length)];
        
        const enemy = new MonsterState();
        enemy.id = enemyId++;
        enemy.kind = enemyType.kind;
        enemy.x = ex;
        enemy.y = ey;
        enemy.hp = enemyType.hp;

        // Add weapon data from LanguageData
        if (enemyType.weaponKeys.length > 0) {
          const weaponKey = enemyType.weaponKeys[Math.floor(rng() * enemyType.weaponKeys.length)];
          const weaponEntry = languageData.getEntry(weaponKey);
          
          if (weaponEntry && weaponEntry.weapon_effect) {
            // Store weapon effect data in monster's data map
            enemy.data.set('weapon_name', weaponEntry.weapon_effect.name);
            enemy.data.set('weapon_damage', weaponEntry.weapon_effect.damage);
            enemy.data.set('weapon_cost', weaponEntry.weapon_effect.cost);
            enemy.data.set('weapon_properties', JSON.stringify(weaponEntry.weapon_effect.properties));
          }
        }

        gameState.entities.push(enemy);
      }
    }
  }

  /**
   * Plain data version of spawnEnemiesWithWeapons
   */
  static spawnEnemiesWithWeaponsPlain(
    gameState: any, 
    languageData: LanguageData, 
    rng: () => number,
    count: number = 3
  ): void {
    const candidateOffsets = [
      { dx: 3, dy: 0 }, { dx: -3, dy: 0 }, { dx: 0, dy: 3 }, { dx: 0, dy: -3 },
      { dx: 3, dy: 3 }, { dx: -3, dy: 3 }, { dx: 3, dy: -3 }, { dx: -3, dy: -2 },
      { dx: 4, dy: 0 }, { dx: -4, dy: 0 }, { dx: 0, dy: 4 }, { dx: 0, dy: -4 }
    ];

    const walkableTiles = new Set([
      this.TILE_TYPES.FLOOR,
      this.TILE_TYPES.ROOM_FLOOR,
      this.TILE_TYPES.CORRIDOR
    ]);

    const enemyTypes = [
      { kind: 'goblin', hp: 15, weaponKeys: ['dagger.n.01'] },
      { kind: 'orc', hp: 25, weaponKeys: ['scimitar.n.01', 'axe.n.01'] },
      { kind: 'slime', hp: 10, weaponKeys: [] }, // Unarmed enemy
      { kind: 'skeleton', hp: 20, weaponKeys: ['shortsword.n.01'] },
      { kind: 'goblin_archer', hp: 15, weaponKeys: ['shortbow.n.01'] }
    ];

    let enemyId = 1;

    // Shuffle offsets for variety
    for (let i = candidateOffsets.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [candidateOffsets[i], candidateOffsets[j]] = [candidateOffsets[j], candidateOffsets[i]];
    }

    for (const offset of candidateOffsets) {
      if (enemyId > count) break;

      const ex = gameState.player.x + offset.dx;
      const ey = gameState.player.y + offset.dy;

      if (ex >= 0 && ex < gameState.map.width && 
          ey >= 0 && ey < gameState.map.height &&
          gameState.map.tiles[ey] && gameState.map.tiles[ey].values &&
          walkableTiles.has(gameState.map.tiles[ey].values[ex])) {
        
        // Select enemy type
        const enemyType = enemyTypes[Math.floor(rng() * enemyTypes.length)];
        
        const enemy = {
          id: enemyId++,
          kind: enemyType.kind,
          x: ex,
          y: ey,
          hp: enemyType.hp,
          hostile: true,
          data: {}
        };

        // Add weapon data from LanguageData
        if (enemyType.weaponKeys.length > 0) {
          const weaponKey = enemyType.weaponKeys[Math.floor(rng() * enemyType.weaponKeys.length)];
          const weaponEntry = languageData.getEntry(weaponKey);
          
          if (weaponEntry && weaponEntry.weapon_effect) {
            // Store weapon effect data in enemy's data object
            enemy.data.weapon_name = weaponEntry.weapon_effect.name;
            enemy.data.weapon_damage = weaponEntry.weapon_effect.damage;
            enemy.data.weapon_cost = weaponEntry.weapon_effect.cost;
            enemy.data.weapon_properties = JSON.stringify(weaponEntry.weapon_effect.properties);
          }
        }

        gameState.entities.push(enemy);
      }
    }
  }

  /**
   * Plain data version of spawnInitialMonsters
   */
  private static spawnInitialMonstersPlain(gameState: any, mapData: GameMap, rng: () => number): void {
    const candidateOffsets = [
      { dx: 2, dy: 0 }, { dx: -2, dy: 0 }, { dx: 0, dy: 2 }, { dx: 0, dy: -2 },
      { dx: 2, dy: 2 }, { dx: -2, dy: 2 }, { dx: 2, dy: -2 }, { dx: -2, dy: -2 }
    ];

    const walkableTiles = new Set([
      this.TILE_TYPES.FLOOR,
      this.TILE_TYPES.ROOM_FLOOR,
      this.TILE_TYPES.CORRIDOR
    ]);

    const monsterTypes = ['goblin', 'slime', 'orc'];
    let monsterId = 1;

    for (const offset of candidateOffsets) {
      if (monsterId > 3) break; // Limit initial monsters

      const mx = gameState.player.x + offset.dx;
      const my = gameState.player.y + offset.dy;

      if (mx >= 0 && mx < mapData.width && 
          my >= 0 && my < mapData.height &&
          mapData.tiles[my] && mapData.tiles[my].values &&
          walkableTiles.has(mapData.tiles[my].values[mx])) {
        
        const monster = {
          id: monsterId++,
          kind: monsterTypes[Math.floor(rng() * monsterTypes.length)],
          x: mx,
          y: my,
          hp: 20,
          hostile: true,
          data: {}
        };

        gameState.entities.push(monster);
      }
    }
  }

  /**
   * Plain data version of addStarterItems
   */
  private static addStarterItemsPlain(player: any): void {
    // Add starter items as strings (inventory expects strings)
    player.inventory.push("Shortsword");
    player.inventory.push("Shortbow");
  }

  /* Removed useless scatter items plan */

}
