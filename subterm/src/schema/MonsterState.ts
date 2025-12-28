import { Schema, type, MapSchema } from "@colyseus/schema";

export class MonsterState extends Schema {
  @type("number") id: number = 0;
  @type("string") kind: string = "";
  @type("string") info: object = {};
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") hp: number = 20;
  @type("boolean") hostile: boolean = true;
  @type({ map: "string" }) data: MapSchema<string> = new MapSchema<string>();
}
