import { GameState } from "../schema/GameState";
import { MonsterState } from "../schema/MonsterState";

export interface AIResult {
  logs: string[];
  movedMonsters: { id: number; x: number; y: number }[];
}

export class AICommand {
  /**
   * Run one AI turn for all monsters.
   * - Skip pathfinding for distant monsters (>20 tiles Manhattan distance)
   * - Use simple pathfinding for closer monsters
   * - Move one step if path exists and next step isn't occupied by another monster
   */
  static takeMonsterTurns(gameState: GameState): AIResult {
    const result: AIResult = {
      logs: [],
      movedMonsters: []
    };

    const player = gameState.player;
    if (!player) return result;

    const playerX = player.x;
    const playerY = player.y;

    for (const monster of gameState.entities) {
      if (!monster.hostile) continue;

      const monsterX = monster.x;
      const monsterY = monster.y;

      // Optimization: skip if too far
      const distance = Math.abs(playerX - monsterX) + Math.abs(playerY - monsterY);
      if (distance > 20) continue;

      // Simple pathfinding - move towards player
      const nextPosition = this.getNextPositionTowards(
        monsterX, 
        monsterY, 
        playerX, 
        playerY,
        gameState
      );

      if (nextPosition && !this.isPositionOccupied(nextPosition.x, nextPosition.y, gameState, monster.id)) {
        // Update monster position
        monster.x = nextPosition.x;
        monster.y = nextPosition.y;

        result.movedMonsters.push({
          id: monster.id,
          x: nextPosition.x,
          y: nextPosition.y
        });

        const direction = this.getDirectionName(
          { x: monsterX, y: monsterY },
          { x: nextPosition.x, y: nextPosition.y }
        );

        result.logs.push(`${monster.kind} moves ${direction}`);
      }
    }

    return result;
  }

  private static getNextPositionTowards(
    fromX: number, 
    fromY: number, 
    toX: number, 
    toY: number,
    gameState: GameState
  ): { x: number; y: number } | null {
    const dx = Math.sign(toX - fromX);
    const dy = Math.sign(toY - fromY);

    // Try diagonal first, then cardinal directions
    const candidates = [
      { x: fromX + dx, y: fromY + dy },
      { x: fromX + dx, y: fromY },
      { x: fromX, y: fromY + dy }
    ];

    for (const candidate of candidates) {
      if (this.isValidPosition(candidate.x, candidate.y, gameState)) {
        return candidate;
      }
    }

    return null;
  }

  private static isValidPosition(x: number, y: number, gameState: GameState): boolean {
    // Check bounds
    if (x < 0 || y < 0 || x >= gameState.map.width || y >= gameState.map.height) {
      return false;
    }

    // Check if tile is walkable (assuming 0 is floor, 1 is wall)
    const tileRow = gameState.map.tiles[y];
    if (!tileRow) return false;

    const tile = tileRow.values[x];
    const wallTile = gameState.map.tile_constants.get("WALL") ?? 1;
    
    return tile !== wallTile;
  }

  private static isPositionOccupied(
    x: number, 
    y: number, 
    gameState: GameState, 
    excludeMonsterId: number
  ): boolean {
    // Check if player is at this position
    if (gameState.player.x === x && gameState.player.y === y) {
      return true;
    }

    // Check if any other monster is at this position
    for (const monster of gameState.entities) {
      if (monster.id !== excludeMonsterId && monster.x === x && monster.y === y) {
        return true;
      }
    }

    return false;
  }

  private static getDirectionName(
    fromPos: { x: number; y: number }, 
    toPos: { x: number; y: number }
  ): string {
    const dx = toPos.x - fromPos.x;
    const dy = toPos.y - fromPos.y;

    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? 'east' : 'west';
    } else if (Math.abs(dy) > Math.abs(dx)) {
      return dy > 0 ? 'south' : 'north';
    } else {
      // Equal movement - prefer horizontal
      if (dx !== 0) {
        return dx > 0 ? 'east' : 'west';
      } else {
        return dy > 0 ? 'south' : 'north';
      }
    }
  }
}