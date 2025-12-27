import { Schema, type, ArraySchema, MapSchema } from "@colyseus/schema";
import { GameMap } from "./GameMap";
import { PlayerState } from "./PlayerState";
import { MonsterState } from "./MonsterState";
import { Item } from "./Item";

export class GameState extends Schema {
  @type(GameMap) map: GameMap = new GameMap();
  @type(PlayerState) player: PlayerState = new PlayerState();
  @type([MonsterState]) entities: ArraySchema<MonsterState> = new ArraySchema<MonsterState>();
  @type({ map: [Item] }) world: MapSchema<ArraySchema<Item>> = new MapSchema<ArraySchema<Item>>();
}
