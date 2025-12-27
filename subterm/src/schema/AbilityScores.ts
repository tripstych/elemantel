import { Schema, type } from "@colyseus/schema";

export class AbilityScores extends Schema {
  @type("number") strength: number = 10;
  @type("number") dexterity: number = 10;
  @type("number") constitution: number = 10;
  @type("number") intelligence: number = 10;
  @type("number") wisdom: number = 10;
  @type("number") charisma: number = 10;

  getAbilityMod(score: number): number {
    return Math.floor((score - 10) / 2);
  }
}
