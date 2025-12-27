import { Schema, type, ArraySchema } from "@colyseus/schema";
import { AbilityScores } from "./AbilityScores";

export class CombatStats extends Schema {
  @type(AbilityScores) abilities: AbilityScores = new AbilityScores();
  @type("number") hp: number = 0;
  @type("number") max_hp: number = 0;
  @type("number") armor_class: number = 10;
  @type("number") speed: number = 0;
  @type("number") proficiency_bonus: number = 2;
  @type(["string"]) conditions: ArraySchema<string> = new ArraySchema<string>();
}
