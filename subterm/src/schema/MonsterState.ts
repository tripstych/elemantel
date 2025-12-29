import { Schema, type, ArraySchema, MapSchema } from "@colyseus/schema"; 

export class MonsterState extends Schema {
  info: any = {};
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") id: number = 0;
  @type("string") kind: string = "";
  @type("number") mana: number = 50;
  @type("number") level: number = 1;
  @type("number") experience: number = 0;
  @type(["string"]) inventory: ArraySchema<string> = new ArraySchema<string>();

  @type("number") strength: number = 32;
  @type("number") dexterity: number = 32;
  @type("number") constitution: number = 32;
  @type("number") intelligence: number = 32;
  @type("number") wisdom: number = 32;
  @type("number") charisma: number = 32;

  @type("number") defense: number = 32;
  @type("number") proficiency_bonus: number = 6;

  @type("number") hp: number = 100;
  @type("number") max_hp: number = 100;
  @type("number") temporary_hp: number = 0;
  @type("number") spell_save_dc: number = 8;
  @type("number") spell_attack_bonus: number = 0;



}
