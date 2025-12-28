import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";
import { GameMap } from "../../schema/GameMap";
import { WorldItem } from "../../schema/Item";

// Use shared GameMap schema to match MyRoom logic

// Equipment slots schema
class HandSlots extends Schema {
  @type("string") main_hand: string = "";
  @type("string") off_hand: string = "";
}

class BodySlots extends Schema {
  @type("string") head: string = "";
  @type("string") face: string = "";
  @type("string") neck: string = "";
  @type("string") torso: string = "";
  @type("string") back: string = "";
  @type("string") waist: string = "";
  @type("string") wrists: string = "";
  @type("string") left_finger: string = "";
  @type("string") right_finger: string = "";
  @type("string") legs: string = "";
  @type("string") feet: string = "";
}

class Equipment extends Schema {
  @type(HandSlots) hand_slots: HandSlots = new HandSlots();
  @type(BodySlots) body_slots: BodySlots = new BodySlots();
}

// Embed player schema locally to avoid cross-module definition mismatches
export class PlayerSchema extends Schema {
  @type("string") name: string = "Hero";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") hp: number = 100;
  @type("number") max_hp: number = 100;
  @type("number") mana: number = 50;
  @type(["string"]) inventory: ArraySchema<string> = new ArraySchema<string>();

  @type("number") strength: number = 10;
  @type("number") dexterity: number = 10;
  @type("number") constitution: number = 10;
  @type("number") intelligence: number = 10;
  @type("number") wisdom: number = 10;
  @type("number") charisma: number = 10;

  @type("number") proficiency_bonus: number = 2;
  @type("number") armor_class: number = 10;
  @type(Equipment) equipment: Equipment = new Equipment();
}

export class MyRoomState extends Schema {
  @type(GameMap) map: GameMap = new GameMap();
  @type(PlayerSchema) player: PlayerSchema = new PlayerSchema();
  @type({ map: WorldItem }) world: MapSchema<WorldItem> = new MapSchema<WorldItem>();
}
