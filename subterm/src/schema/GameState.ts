import { Schema, type, ArraySchema, MapSchema } from "@colyseus/schema";
import { GameMap } from "./GameMap";
import { PlayerState } from "./PlayerState";

export class GameState extends Schema {
  @type(GameMap) map: GameMap = new GameMap();
  @type(PlayerState) player: PlayerState = new PlayerState();
}
