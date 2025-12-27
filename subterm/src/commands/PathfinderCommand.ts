import { GameState } from "../schema/GameState";
import { GameMap } from "../schema/GameMap";

export interface Position {
  x: number;
  y: number;
}

export interface PathNode {
  position: Position;
  gCost: number;
  hCost: number;
  fCost: number;
  parent: Position | null;
}

export type HeuristicFunction = (pos1: Position, pos2: Position) => number;

export class PathfinderCommand {
  private static readonly SQRT_2 = Math.sqrt(2);

  /**
   * A* pathfinding algorithm
   * Returns path from start to goal, or null if no path exists
   */
  static astar(
    gameState: GameState,
    start: Position,
    goal: Position,
    options: {
      allowDiagonal?: boolean;
      heuristic?: HeuristicFunction;
      walkableTiles?: Set<number>;
    } = {}
  ): Position[] | null {
    const {
      allowDiagonal = false,
      heuristic = PathfinderCommand.manhattanDistance,
      walkableTiles = new Set([0, 1, 2, 3, 4, 5, 6]) // Default walkable tiles
    } = options;

    // Validate start and goal positions
    if (!PathfinderCommand.isValidPosition(gameState.map, start, walkableTiles) ||
        !PathfinderCommand.isValidPosition(gameState.map, goal, walkableTiles)) {
      return null;
    }

    // Early exit if start equals goal
    if (start.x === goal.x && start.y === goal.y) {
      return [start];
    }

    const openSet: PathNode[] = [];
    const closedSet = new Set<string>();
    const gCosts = new Map<string, number>();
    const cameFrom = new Map<string, Position>();

    // Initialize start node
    const startNode: PathNode = {
      position: start,
      gCost: 0,
      hCost: heuristic(start, goal),
      fCost: heuristic(start, goal),
      parent: null
    };

    openSet.push(startNode);
    gCosts.set(PathfinderCommand.posToKey(start), 0);

    while (openSet.length > 0) {
      // Find node with lowest fCost
      let currentIndex = 0;
      for (let i = 1; i < openSet.length; i++) {
        if (openSet[i].fCost < openSet[currentIndex].fCost) {
          currentIndex = i;
        }
      }

      const current = openSet.splice(currentIndex, 1)[0];
      const currentKey = PathfinderCommand.posToKey(current.position);

      // Check if we reached the goal
      if (current.position.x === goal.x && current.position.y === goal.y) {
        return PathfinderCommand.reconstructPath(cameFrom, current.position);
      }

      closedSet.add(currentKey);

      // Check neighbors
      const neighbors = PathfinderCommand.getNeighbors(gameState.map, current.position, allowDiagonal, walkableTiles);
      
      for (const neighbor of neighbors) {
        const neighborKey = PathfinderCommand.posToKey(neighbor);

        if (closedSet.has(neighborKey)) {
          continue;
        }

        const moveCost = PathfinderCommand.getMoveCost(current.position, neighbor, allowDiagonal);
        const tentativeGCost = current.gCost + moveCost;

        const existingNode = openSet.find(node => 
          node.position.x === neighbor.x && node.position.y === neighbor.y
        );

        if (!existingNode) {
          // Add new node to open set
          const hCost = heuristic(neighbor, goal);
          const newNode: PathNode = {
            position: neighbor,
            gCost: tentativeGCost,
            hCost: hCost,
            fCost: tentativeGCost + hCost,
            parent: current.position
          };
          openSet.push(newNode);
          gCosts.set(neighborKey, tentativeGCost);
          cameFrom.set(neighborKey, current.position);
        } else if (tentativeGCost < existingNode.gCost) {
          // Update existing node
          existingNode.gCost = tentativeGCost;
          existingNode.fCost = tentativeGCost + existingNode.hCost;
          existingNode.parent = current.position;
          gCosts.set(neighborKey, tentativeGCost);
          cameFrom.set(neighborKey, current.position);
        }
      }
    }

    return null; // No path found
  }

  /**
   * Find path using Dijkstra's algorithm (uniform cost search)
   */
  static dijkstra(
    gameState: GameState,
    start: Position,
    goal: Position,
    options: {
      allowDiagonal?: boolean;
      walkableTiles?: Set<number>;
    } = {}
  ): Position[] | null {
    return PathfinderCommand.astar(gameState, start, goal, {
      ...options,
      heuristic: () => 0 // Dijkstra uses no heuristic
    });
  }

  /**
   * Find path using BFS (shortest path in terms of steps)
   */
  static bfs(
    gameState: GameState,
    start: Position,
    goal: Position,
    options: {
      allowDiagonal?: boolean;
      walkableTiles?: Set<number>;
    } = {}
  ): Position[] | null {
    const { allowDiagonal = false, walkableTiles = new Set([0, 1, 2, 3, 4, 5, 6]) } = options;

    if (!PathfinderCommand.isValidPosition(gameState.map, start, walkableTiles) ||
        !PathfinderCommand.isValidPosition(gameState.map, goal, walkableTiles)) {
      return null;
    }

    if (start.x === goal.x && start.y === goal.y) {
      return [start];
    }

    const queue: Position[] = [start];
    const visited = new Set<string>();
    const cameFrom = new Map<string, Position>();

    visited.add(PathfinderCommand.posToKey(start));

    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentKey = PathfinderCommand.posToKey(current);

      if (current.x === goal.x && current.y === goal.y) {
        return PathfinderCommand.reconstructPath(cameFrom, current);
      }

      const neighbors = PathfinderCommand.getNeighbors(gameState.map, current, allowDiagonal, walkableTiles);

      for (const neighbor of neighbors) {
        const neighborKey = PathfinderCommand.posToKey(neighbor);

        if (!visited.has(neighborKey)) {
          visited.add(neighborKey);
          cameFrom.set(neighborKey, current);
          queue.push(neighbor);
        }
      }
    }

    return null;
  }

  /**
   * Manhattan distance heuristic
   */
  static manhattanDistance(pos1: Position, pos2: Position): number {
    return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y);
  }

  /**
   * Euclidean distance heuristic
   */
  static euclideanDistance(pos1: Position, pos2: Position): number {
    return Math.sqrt(
      Math.pow(pos2.x - pos1.x, 2) + Math.pow(pos2.y - pos1.y, 2)
    );
  }

  /**
   * Chebyshev distance heuristic (for 8-directional movement)
   */
  static chebyshevDistance(pos1: Position, pos2: Position): number {
    return Math.max(Math.abs(pos1.x - pos2.x), Math.abs(pos1.y - pos2.y));
  }

  /**
   * Get valid neighboring positions
   */
  static getNeighbors(
    map: GameMap,
    pos: Position,
    allowDiagonal: boolean,
    walkableTiles: Set<number>
  ): Position[] {
    const neighbors: Position[] = [];
    const { x, y } = pos;

    // Cardinal directions
    const cardinal = [
      { dx: 0, dy: -1 },  // North
      { dx: 1, dy: 0 },   // East
      { dx: 0, dy: 1 },   // South
      { dx: -1, dy: 0 }   // West
    ];

    for (const { dx, dy } of cardinal) {
      const neighbor = { x: x + dx, y: y + dy };
      if (PathfinderCommand.isValidPosition(map, neighbor, walkableTiles)) {
        neighbors.push(neighbor);
      }
    }

    // Diagonal directions
    if (allowDiagonal) {
      const diagonal = [
        { dx: 1, dy: -1 },   // Northeast
        { dx: 1, dy: 1 },    // Southeast
        { dx: -1, dy: 1 },   // Southwest
        { dx: -1, dy: -1 }   // Northwest
      ];

      for (const { dx, dy } of diagonal) {
        const neighbor = { x: x + dx, y: y + dy };
        if (PathfinderCommand.isValidPosition(map, neighbor, walkableTiles)) {
          neighbors.push(neighbor);
        }
      }
    }

    return neighbors;
  }

  /**
   * Check if a position is valid and walkable
   */
  private static isValidPosition(
    map: GameMap,
    pos: Position,
    walkableTiles: Set<number>
  ): boolean {
    // Check bounds
    if (pos.x < 0 || pos.y < 0 || pos.x >= map.width || pos.y >= map.height) {
      return false;
    }

    // Check if tile is walkable
    const tileRow = map.tiles[pos.y];
    if (!tileRow) return false;

    const tile = tileRow.values[pos.x];
    return walkableTiles.has(tile);
  }

  /**
   * Get movement cost between two positions
   */
  private static getMoveCost(from: Position, to: Position, allowDiagonal: boolean): number {
    const dx = Math.abs(to.x - from.x);
    const dy = Math.abs(to.y - from.y);

    if (allowDiagonal && dx === 1 && dy === 1) {
      return PathfinderCommand.SQRT_2; // Diagonal movement
    }
    return 1.0; // Cardinal movement
  }

  /**
   * Reconstruct path from came_from map
   */
  private static reconstructPath(cameFrom: Map<string, Position>, current: Position): Position[] {
    const path: Position[] = [current];
    const currentKey = PathfinderCommand.posToKey(current);

    while (cameFrom.has(currentKey)) {
      const parent = cameFrom.get(currentKey)!;
      path.unshift(parent);
      
      if (parent.x === current.x && parent.y === current.y) {
        break; // Prevent infinite loops
      }
      
      current.x = parent.x;
      current.y = parent.y;
    }

    return path;
  }

  /**
   * Convert position to string key for map lookups
   */
  private static posToKey(pos: Position): string {
    return `${pos.x},${pos.y}`;
  }

  /**
   * Get all reachable positions from a start position within a maximum distance
   */
  static getReachablePositions(
    gameState: GameState,
    start: Position,
    maxDistance: number,
    options: {
      allowDiagonal?: boolean;
      walkableTiles?: Set<number>;
    } = {}
  ): Position[] {
    const { allowDiagonal = false, walkableTiles = new Set([0, 1, 2, 3, 4, 5, 6]) } = options;

    const reachable: Position[] = [];
    const visited = new Set<string>();
    const queue: { pos: Position; distance: number }[] = [{ pos: start, distance: 0 }];

    visited.add(PathfinderCommand.posToKey(start));

    while (queue.length > 0) {
      const { pos: current, distance } = queue.shift()!;

      if (distance <= maxDistance) {
        reachable.push(current);
      }

      if (distance >= maxDistance) {
        continue;
      }

      const neighbors = PathfinderCommand.getNeighbors(gameState.map, current, allowDiagonal, walkableTiles);

      for (const neighbor of neighbors) {
        const neighborKey = PathfinderCommand.posToKey(neighbor);

        if (!visited.has(neighborKey)) {
          visited.add(neighborKey);
          const moveCost = PathfinderCommand.getMoveCost(current, neighbor, allowDiagonal);
          queue.push({ pos: neighbor, distance: distance + moveCost });
        }
      }
    }

    return reachable;
  }
}