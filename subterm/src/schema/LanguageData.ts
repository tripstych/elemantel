import { Schema, type, MapSchema } from "@colyseus/schema";

import { GAME_CONSTANTS } from '../../../shared/constants';

export class ElementalOrigin extends Schema {
  @type("number") fire: number = 0;
  @type("number") water: number = 0;
  @type("number") earth: number = 0;
  @type("number") air: number = 0;
  item: any;
}

export class SpellEffect extends Schema {
  @type("string") type: string = "";
  @type("string") target: string = "";
  @type("string") amount: string = "";
  @type("string") element: string = "";
  @type("string") description: string = "";
}

export class WeaponEffect extends Schema {
  @type("string") name: string = "";
  @type("string") cost: string = "";
  @type("string") damage: string = "";
  @type(["string"]) properties: string[] = [];
}

export class LanguageEntry extends Schema {
  @type("string") word: string = "";
  @type("string") definition: string = "";
  @type(ElementalOrigin) origin: ElementalOrigin = new ElementalOrigin();
  @type("string") type: string = "";
  @type("number") weight: number = 0;
  @type("object") item: object = {};
}

export class LanguageData extends Schema {
  // @type({ map: LanguageEntry }) entries: MapSchema<LanguageEntry> = new MapSchema<LanguageEntry>();
  
  // Helper method to load from JSON
  loadFromJSON(jsonData: any) {
    const shouldLog = (typeof process !== "undefined" && process.env && process.env.NODE_ENV !== "test");
    // Clear existing entries
    this.entries.clear();
    // Load each entry
    for (const [key, value] of Object.entries(jsonData)) {
      const entry = new LanguageEntry();
      
      // Required fields
      entry.word = (value as any).word || "";
      entry.definition = (value as any).definition || "";
      
      // Origin (required)
      // what is this shit?   probably junk
      if ((value as any).origin) {
        
        entry.origin.fire = (value as any).origin.fire || 0;
        entry.origin.water = (value as any).origin.water || 0;
        entry.origin.earth = (value as any).origin.earth || 0;
        entry.origin.air = (value as any).origin.air || 0;

        // if (GAME_CONSTANTS.DEBUG) { console.log(`LanguageData: Loaded origin for ${key}:`, { fire: entry.origin.fire, water: entry.origin.water, earth: entry.origin.earth, air: entry.origin.air }); }

      } else {
        if (GAME_CONSTANTS.DEBUG) {
          console.log(`LanguageData: No origin data for ${key}`);
        }
      }
      
      this.entries.set(key, entry);
    }
  }
  
  // Helper method to get entry by key
  getEntry(key: string): LanguageEntry | undefined {
    return this.entries.get(key);
  }
  
  // Helper method to search entries
  searchEntries(query: string): LanguageEntry[] {
    const results: LanguageEntry[] = [];
    const lowerQuery = query.toLowerCase();
    
    for (const entry of this.entries.values()) {
      if (entry.word.toLowerCase().includes(lowerQuery) ||
          entry.definition.toLowerCase().includes(lowerQuery)) {
        results.push(entry);
      }
    }
    
    return results;
  }
}
