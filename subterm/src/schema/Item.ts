import { Schema, type } from "@colyseus/schema";

export class Item extends Schema {
  @type("string") name: string = "";
  @type("string") type: string = "";
  @type("string") description: string = "";
  @type("number") value: number = 0;
  @type("number") weight: number = 0;
}
