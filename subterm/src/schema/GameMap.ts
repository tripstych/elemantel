import { Schema, type, ArraySchema, MapSchema } from "@colyseus/schema";
import { Item } from "./Item";
import { MonsterState } from "./MonsterState";

export class Position extends Schema {
  @type("number") x: number = 0;
  @type("number") y: number = 0;
}

export class Tile extends Schema {
  @type("number") terrain: number = 0;
  @type([Item]) items: ArraySchema<Item> = new ArraySchema<Item>();
  @type([MonsterState]) monsters: ArraySchema<MonsterState> = new ArraySchema<MonsterState>();
  @type("boolean") visible: boolean = false;
  @type("boolean") explored: boolean = false;
  @type("number") light: number = 0;
  @type("string") feature: string = ""; // e.g., door, trap, stairs
}

export class TileRow extends Schema {
  @type([Tile]) tiles: ArraySchema<Tile> = new ArraySchema<Tile>();
}

export class GameMap extends Schema {
  @type("number") width: number = 0;
  @type("number") height: number = 0;
  @type([TileRow]) tiles: ArraySchema<TileRow> = new ArraySchema<TileRow>();
  @type(Position) entrance: Position = new Position();
  @type(Position) exit: Position = new Position();
  @type({ map: "number" }) tile_constants: MapSchema<number> = new MapSchema<number>();
}
