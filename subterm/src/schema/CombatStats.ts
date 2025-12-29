import { Schema, type, ArraySchema } from "@colyseus/schema";
import { AbilityScores } from "./AbilityScores";

export class CombatStats extends Schema {
  @type(AbilityScores) abilities: AbilityScores = new AbilityScores();
  @type("number") hp: number = 0;
  @type("number") max_hp: number = 0;
  @type("number") armor_class: number = 32;
  @type("number") speed: number = 0;
  @type("number") proficiency_bonus: number = 6;
  @type(["string"]) conditions: ArraySchema<string> = new ArraySchema<string>();
  
  // Weapon combat properties
  @type("string") weapon_damage: string = "";
  @type(["string"]) weapon_properties: ArraySchema<string> = new ArraySchema<string>();
  @type("string") weapon_name: string = "";
  @type("string") weapon_cost: string = "";
}
