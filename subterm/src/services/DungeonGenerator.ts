// Tile type constants (matching the Python version)
export const TILES = {
  FLOOR: 0,
  WALL: 1,
  DOOR: 2,
  CORRIDOR: 3,
  ROOM_FLOOR: 4,
  ENTRANCE: 5,
  EXIT: 6
} as const;

export type TileType = typeof TILES[keyof typeof TILES];

export interface Room {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DungeonGeneratorOptions {
  width: number;
  height: number;
  seed?: number;
  algorithm?: 'bsp' | 'cellular' | 'drunkard' | 'rooms_corridors';
}

interface BSPContainer {
  x: number;
  y: number;
  width: number;
  height: number;
  children: BSPContainer[];
  room?: Room;
}

export class DungeonGenerator {
  private width: number;
  private height: number;
  private seed: number;
  private algorithm: string;
  private grid: number[][];
  private rooms: Room[] = [];
  private rng: () => number;

  constructor(options: DungeonGeneratorOptions) {
    this.width = options.width;
    this.height = options.height;
    this.seed = options.seed || Math.random() * 10000;
    this.algorithm = options.algorithm || 'bsp';
    
    // Initialize grid with walls
    this.grid = Array(this.height).fill(null).map(() => 
      Array(this.width).fill(TILES.WALL)
    );

    // Simple RNG using seed
    let seedValue = this.seed;
    this.rng = () => {
      seedValue = (seedValue * 9301 + 49297) % 233280;
      return seedValue / 233280;
    };
  }

  generate(): number[][] {
    // Clear grid and start with walls
    this.grid = Array(this.height).fill(null).map(() => 
      Array(this.width).fill(TILES.WALL)
    );

    switch (this.algorithm) {
      case 'bsp':
        this.generateBSP();
        break;
      case 'cellular':
        this.generateCellular();
        break;
      case 'drunkard':
        this.generateDrunkard();
        break;
      case 'rooms_corridors':
        this.generateRoomsCorridors();
        break;
      default:
        this.generateRoomsCorridors(); // fallback
    }

    // Add entrance and exit
    this.addEntranceExit();

    return this.grid;
  }

  private generateBSP(): void {
    const params = {
      minRoomSize: 5,
      maxRoomSize: 15,
      minSplitSize: 10
    };

    // Create root container
    const root: BSPContainer = {
      x: 1,
      y: 1,
      width: this.width - 2,
      height: this.height - 2,
      children: []
    };

    // Recursively split
    this.bspSplit(root, params, 0);
    
    // Create rooms in leaf nodes
    this.bspCreateRooms(root, params);
    
    // Connect rooms
    this.bspConnectRooms(root);
  }

  private bspSplit(container: BSPContainer, params: any, depth: number = 0): void {
    if (depth > 5) return;

    const canSplitH = container.width >= params.minSplitSize * 2;
    const canSplitV = container.height >= params.minSplitSize * 2;

    if (!canSplitH && !canSplitV) return;

    let splitHorizontal: boolean;
    if (canSplitH && canSplitV) {
      splitHorizontal = this.rng() > 0.5;
    } else if (canSplitH) {
      splitHorizontal = true;
    } else {
      splitHorizontal = false;
    }

    if (splitHorizontal) {
      const splitPos = Math.floor(
        params.minSplitSize + this.rng() * (container.width - params.minSplitSize * 2)
      );

      const child1: BSPContainer = {
        x: container.x,
        y: container.y,
        width: splitPos,
        height: container.height,
        children: []
      };

      const child2: BSPContainer = {
        x: container.x + splitPos,
        y: container.y,
        width: container.width - splitPos,
        height: container.height,
        children: []
      };

      container.children = [child1, child2];
    } else {
      const splitPos = Math.floor(
        params.minSplitSize + this.rng() * (container.height - params.minSplitSize * 2)
      );

      const child1: BSPContainer = {
        x: container.x,
        y: container.y,
        width: container.width,
        height: splitPos,
        children: []
      };

      const child2: BSPContainer = {
        x: container.x,
        y: container.y + splitPos,
        width: container.width,
        height: container.height - splitPos,
        children: []
      };

      container.children = [child1, child2];
    }

    this.bspSplit(container.children[0], params, depth + 1);
    this.bspSplit(container.children[1], params, depth + 1);
  }

  private bspCreateRooms(container: BSPContainer, params: any): void {
    if (!container.children || container.children.length === 0) {
      // Leaf node - create room
      const roomWidth = Math.floor(
        params.minRoomSize + this.rng() * (Math.min(params.maxRoomSize, container.width - 2) - params.minRoomSize)
      );
      const roomHeight = Math.floor(
        params.minRoomSize + this.rng() * (Math.min(params.maxRoomSize, container.height - 2) - params.minRoomSize)
      );

      const roomX = container.x + Math.floor(this.rng() * (container.width - roomWidth - 1));
      const roomY = container.y + Math.floor(this.rng() * (container.height - roomHeight - 1));

      // Carve room
      for (let y = roomY; y < roomY + roomHeight; y++) {
        for (let x = roomX; x < roomX + roomWidth; x++) {
          if (y < this.height && x < this.width) {
            this.grid[y][x] = TILES.ROOM_FLOOR;
          }
        }
      }

      const room: Room = { x: roomX, y: roomY, width: roomWidth, height: roomHeight };
      this.rooms.push(room);
      container.room = room;
    } else {
      // Recurse into children
      for (const child of container.children) {
        this.bspCreateRooms(child, params);
      }
    }
  }

  private bspConnectRooms(container: BSPContainer): void {
    if (!container.children || container.children.length === 0) return;

    const child1 = container.children[0];
    const child2 = container.children[1];
    
    this.bspConnectRooms(child1);
    this.bspConnectRooms(child2);

    const room1 = this.bspGetRoom(child1);
    const room2 = this.bspGetRoom(child2);

    if (room1 && room2) {
      const center1 = {
        x: room1.x + Math.floor(room1.width / 2),
        y: room1.y + Math.floor(room1.height / 2)
      };
      const center2 = {
        x: room2.x + Math.floor(room2.width / 2),
        y: room2.y + Math.floor(room2.height / 2)
      };

      this.createCorridor(center1.x, center1.y, center2.x, center2.y);
    }
  }

  private bspGetRoom(container: BSPContainer): Room | null {
    if (container.room) return container.room;
    
    if (container.children) {
      for (const child of container.children) {
        const room = this.bspGetRoom(child);
        if (room) return room;
      }
    }
    
    return null;
  }

  private generateCellular(): void {
    const params = {
      wallProbability: 0.45,
      birthLimit: 4,
      deathLimit: 3,
      iterations: 5
    };

    // Initialize with random walls/floors
    for (let y = 1; y < this.height - 1; y++) {
      for (let x = 1; x < this.width - 1; x++) {
        this.grid[y][x] = this.rng() < params.wallProbability ? TILES.WALL : TILES.FLOOR;
      }
    }

    // Run cellular automata
    for (let i = 0; i < params.iterations; i++) {
      this.cellularStep(params);
    }

    // Ensure borders are walls
    for (let x = 0; x < this.width; x++) {
      this.grid[0][x] = TILES.WALL;
      this.grid[this.height - 1][x] = TILES.WALL;
    }
    for (let y = 0; y < this.height; y++) {
      this.grid[y][0] = TILES.WALL;
      this.grid[y][this.width - 1] = TILES.WALL;
    }
  }

  private cellularStep(params: any): void {
    const newGrid = this.grid.map(row => [...row]);

    for (let y = 1; y < this.height - 1; y++) {
      for (let x = 1; x < this.width - 1; x++) {
        const wallCount = this.countNeighbors(x, y, TILES.WALL, true);

        if (this.grid[y][x] === TILES.WALL) {
          if (wallCount < params.deathLimit) {
            newGrid[y][x] = TILES.FLOOR;
          }
        } else {
          if (wallCount > params.birthLimit) {
            newGrid[y][x] = TILES.WALL;
          }
        }
      }
    }

    this.grid = newGrid;
  }

  private generateDrunkard(): void {
    const params = {
      targetFloorPct: 0.4,
      drunkLifetime: 500
    };

    const targetFloors = Math.floor(this.width * this.height * params.targetFloorPct);
    let floorCount = 0;

    // Start in center
    let x = Math.floor(this.width / 2);
    let y = Math.floor(this.height / 2);

    let lifetime = 0;
    while (floorCount < targetFloors && lifetime < params.drunkLifetime * 10) {
      if (this.grid[y][x] === TILES.WALL) {
        this.grid[y][x] = TILES.FLOOR;
        floorCount++;
      }

      // Random direction
      const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]];
      const [dx, dy] = directions[Math.floor(this.rng() * 4)];

      const nx = x + dx;
      const ny = y + dy;

      // Stay in bounds
      if (1 <= nx && nx < this.width - 1 && 1 <= ny && ny < this.height - 1) {
        x = nx;
        y = ny;
      }

      lifetime++;
    }
  }

  private generateRoomsCorridors(): void {
    const params = {
      numRooms: 10,
      minRoomSize: 4,
      maxRoomSize: 10,
      maxAttempts: 100
    };

    // Place rooms
    for (let attempt = 0; attempt < params.maxAttempts && this.rooms.length < params.numRooms; attempt++) {
      const w = Math.floor(params.minRoomSize + this.rng() * (params.maxRoomSize - params.minRoomSize));
      const h = Math.floor(params.minRoomSize + this.rng() * (params.maxRoomSize - params.minRoomSize));
      const x = Math.floor(1 + this.rng() * (this.width - w - 2));
      const y = Math.floor(1 + this.rng() * (this.height - h - 2));

      const room: Room = { x, y, width: w, height: h };

      if (!this.roomsOverlap(room)) {
        this.carveRoom(room);
        this.rooms.push(room);
      }
    }

    // Connect rooms
    for (let i = 0; i < this.rooms.length - 1; i++) {
      const room1 = this.rooms[i];
      const room2 = this.rooms[i + 1];

      const center1 = {
        x: room1.x + Math.floor(room1.width / 2),
        y: room1.y + Math.floor(room1.height / 2)
      };
      const center2 = {
        x: room2.x + Math.floor(room2.width / 2),
        y: room2.y + Math.floor(room2.height / 2)
      };

      this.createCorridor(center1.x, center1.y, center2.x, center2.y);
    }
  }

  private roomsOverlap(newRoom: Room): boolean {
    for (const room of this.rooms) {
      if (newRoom.x - 1 < room.x + room.width &&
          newRoom.x + newRoom.width + 1 > room.x &&
          newRoom.y - 1 < room.y + room.height &&
          newRoom.y + newRoom.height + 1 > room.y) {
        return true;
      }
    }
    return false;
  }

  private carveRoom(room: Room): void {
    for (let y = room.y; y < room.y + room.height; y++) {
      for (let x = room.x; x < room.x + room.width; x++) {
        if (y < this.height && x < this.width) {
          this.grid[y][x] = TILES.ROOM_FLOOR;
        }
      }
    }
  }

  private createCorridor(x1: number, y1: number, x2: number, y2: number): void {
    // L-shaped corridor
    if (this.rng() > 0.5) {
      // Horizontal first
      for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
        if (y1 >= 0 && y1 < this.height && x >= 0 && x < this.width) {
          if (this.grid[y1][x] === TILES.WALL) {
            this.grid[y1][x] = TILES.CORRIDOR;
          }
        }
      }
      // Vertical
      for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
        if (y >= 0 && y < this.height && x2 >= 0 && x2 < this.width) {
          if (this.grid[y][x2] === TILES.WALL) {
            this.grid[y][x2] = TILES.CORRIDOR;
          }
        }
      }
    } else {
      // Vertical first
      for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
        if (y >= 0 && y < this.height && x1 >= 0 && x1 < this.width) {
          if (this.grid[y][x1] === TILES.WALL) {
            this.grid[y][x1] = TILES.CORRIDOR;
          }
        }
      }
      // Horizontal
      for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
        if (y2 >= 0 && y2 < this.height && x >= 0 && x < this.width) {
          if (this.grid[y2][x] === TILES.WALL) {
            this.grid[y2][x] = TILES.CORRIDOR;
          }
        }
      }
    }
  }

  private addEntranceExit(): void {
    // Find floor tiles
    const floors: [number, number][] = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.grid[y][x] === TILES.FLOOR || this.grid[y][x] === TILES.ROOM_FLOOR) {
          floors.push([x, y]);
        }
      }
    }

    if (floors.length < 2) return;

    // Entrance at first floor
    const [entranceX, entranceY] = floors[0];
    this.grid[entranceY][entranceX] = TILES.ENTRANCE;

    // Exit at last floor
    const [exitX, exitY] = floors[floors.length - 1];
    this.grid[exitY][exitX] = TILES.EXIT;
  }

  private countNeighbors(x: number, y: number, tileType: number, diagonal: boolean = false): number {
    let count = 0;
    
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        
        if (!diagonal && Math.abs(dx) === Math.abs(dy)) continue;
        
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
          if (this.grid[ny][nx] === tileType) count++;
        } else {
          count++; // Out of bounds counts as wall
        }
      }
    }
    
    return count;
  }

  getGrid(): number[][] {
    return this.grid;
  }

  getRooms(): Room[] {
    return this.rooms;
  }

  // Convert to Colyseus-compatible format
  toColyseusFormat(): { width: number; height: number; tiles: number[][] } {
    // Convert all floor types to 0 (floor) and walls to 1 (wall) for simplicity
    const simplifiedGrid = this.grid.map(row =>
      row.map(tile => {
        if (tile === TILES.WALL) return 1;
        return 0; // All other types become floor
      })
    );

    // Debug: Count walls vs floors
    let wallCount = 0;
    let floorCount = 0;
    simplifiedGrid.forEach(row => {
      row.forEach(tile => {
        if (tile === 1) wallCount++;
        else floorCount++;
      });
    });
    console.log(`Dungeon tiles: ${wallCount} walls, ${floorCount} floors`);

    return {
      width: this.width,
      height: this.height,
      tiles: simplifiedGrid
    };
  }
}
