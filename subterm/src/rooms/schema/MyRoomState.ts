import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";

// Equipment slots schema
export class HandSlots extends Schema {
  @type("string") main_hand: string = "";
  @type("string") off_hand: string = "";
}

export class BodySlots extends Schema {
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

export class EquipmentSlots extends Schema {
  @type(HandSlots) hand_slots: HandSlots = new HandSlots();
  @type(BodySlots) body_slots: BodySlots = new BodySlots();
}

// Simplified schema with flat tile array
export class GameMap extends Schema {
  @type("number") width: number = 0;
  @type("number") height: number = 0;
  @type(["number"]) tiles: ArraySchema<number> = new ArraySchema<number>();
}

export class PlayerState extends Schema {
  @type("string") name: string = "";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") hp: number = 100;
  @type("number") max_hp: number = 100;
  @type("number") mana: number = 50;
  @type("number") strength: number = 14;
  @type("number") dexterity: number = 12;
  @type("number") constitution: number = 13;
  @type("number") intelligence: number = 10;
  @type("number") wisdom: number = 12;
  @type("number") charisma: number = 10;
  @type("number") armor_class: number = 10;
  @type("number") speed: number = 30;
  @type("number") proficiency_bonus: number = 2;
  @type(["string"]) inventory: ArraySchema<string> = new ArraySchema<string>();
  @type(EquipmentSlots) slots: EquipmentSlots = new EquipmentSlots();
}

export class Item extends Schema {
  @type("string") name: string = "";
  @type("string") type: string = "";
  @type("string") description: string = "";
  @type("number") value: number = 0;
  @type("number") weight: number = 0;
}

export class MyRoomState extends Schema {
  @type(GameMap) map: GameMap = new GameMap();
  @type(PlayerState) player: PlayerState = new PlayerState();
  @type({ map: PlayerState }) players: MapSchema<PlayerState> = new MapSchema<PlayerState>();
  @type({ map: Item }) world: MapSchema<Item> = new MapSchema<Item>();
}
