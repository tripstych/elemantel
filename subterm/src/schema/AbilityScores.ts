import { Schema, type } from "@colyseus/schema";

export class AbilityScores extends Schema {
  @type("number") strength: number = 32;
  @type("number") dexterity: number = 32;
  @type("number") constitution: number = 32;
  @type("number") intelligence: number = 32;
  @type("number") wisdom: number = 32;
  @type("number") charisma: number = 32;

  getAbilityMod(score: number): number {
    return Math.floor((score - 32) / 8);
  }
}
