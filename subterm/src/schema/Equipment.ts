import { Schema, type, ArraySchema } from "@colyseus/schema";

export type DamageType = "slashing" | "piercing" | "bludgeoning";

export class Weapon extends Schema {
  @type("string") name: string = "";
  @type("number") damage: number = 0; // Flat damage on 1-64 scale
  @type("string") damage_type: DamageType = "slashing";
  @type(["string"]) properties: ArraySchema<string> = new ArraySchema<string>();
  @type("number") range: number = 5;
}
