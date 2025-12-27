import { Schema, type, ArraySchema, MapSchema } from "@colyseus/schema";

export class Position extends Schema {
  @type("number") x: number = 0;
  @type("number") y: number = 0;
}

export class TileRow extends Schema {
  @type(["number"]) values: ArraySchema<number> = new ArraySchema<number>();
}

export class GameMap extends Schema {
  @type("number") width: number = 0;
  @type("number") height: number = 0;
  @type([TileRow]) tiles: ArraySchema<TileRow> = new ArraySchema<TileRow>();
  @type(Position) entrance: Position = new Position();
  @type(Position) exit: Position = new Position();
  @type({ map: "number" }) tile_constants: MapSchema<number> = new MapSchema<number>();
}
