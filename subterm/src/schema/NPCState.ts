import { Schema, type, ArraySchema, MapSchema } from "@colyseus/schema";

export class NPCState extends Schema {
  @type("string") name: string = "NPC";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") hp: number = 50;
  @type("number") mana: number = 25;
  @type("number") level: number = 1;
  @type(["string"]) inventory: ArraySchema<string> = new ArraySchema<string>();

  @type("number") strength: number = 10;
  @type("number") dexterity: number = 10;
  @type("number") constitution: number = 10;
  @type("number") intelligence: number = 10;
  @type("number") wisdom: number = 10;
  @type("number") charisma: number = 10;

  @type("number") proficiency_bonus: number = 2;
  @type("number") armor_class: number = 10;
  @type("number") speed: number = 30;

  @type("number") max_hp: number = 50;
  @type("number") temporary_hp: number = 0;
  @type({ map: "number" }) death_saves: MapSchema<number> = new MapSchema<number>();
  @type("number") spell_save_dc: number = 8;
  @type("number") spell_attack_bonus: number = 0;

  @type("string") faction: string = "neutral";
  @type(["string"]) dialogue_options: ArraySchema<string> = new ArraySchema<string>();
  @type("boolean") quest_giver: boolean = false;
  @type("boolean") merchant: boolean = false;
  @type("boolean") hostile: boolean = false;
  @type("string") ai_behavior: string = "passive";
  @type("string") loot_table: string | undefined = undefined;
}
