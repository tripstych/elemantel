import { Schema, type, ArraySchema } from "@colyseus/schema";

export type DamageType = "slashing" | "piercing" | "bludgeoning";

export class Weapon extends Schema {
  @type("string") name: string = "";
  @type("string") damage_dice: string = "1d8";
  @type("string") damage_type: DamageType = "slashing";
  @type(["string"]) properties: ArraySchema<string> = new ArraySchema<string>();
  @type("number") range: number = 5;
}
