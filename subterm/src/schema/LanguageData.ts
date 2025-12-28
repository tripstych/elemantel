import { Schema, type, MapSchema } from "@colyseus/schema";

export class ElementalOrigin extends Schema {
  @type("number") fire: number = 0;
  @type("number") water: number = 0;
  @type("number") earth: number = 0;
  @type("number") air: number = 0;
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
  @type("boolean") derived: boolean = false;
  
  // Optional properties that may not exist in all entries
  @type("string") type: string = "";
  @type("string") spirit: string = "";
  @type("number") weight: number = 0;
  @type(ElementalOrigin) composition: ElementalOrigin = new ElementalOrigin();
  @type(SpellEffect) spell_effect: SpellEffect = new SpellEffect();
  @type(WeaponEffect) weapon_effect: WeaponEffect = new WeaponEffect();
}

export class LanguageData extends Schema {
  @type({ map: LanguageEntry }) entries: MapSchema<LanguageEntry> = new MapSchema<LanguageEntry>();
  
  // Helper method to load from JSON
  loadFromJSON(jsonData: any) {
    // Clear existing entries
    this.entries.clear();
    
    // Load each entry
    for (const [key, value] of Object.entries(jsonData)) {
      const entry = new LanguageEntry();
      
      // Required fields
      entry.word = (value as any).word || "";
      entry.definition = (value as any).definition || "";
      entry.derived = (value as any).derived || false;
      
      // Origin (required)
      if ((value as any).origin) {
        entry.origin.fire = (value as any).origin.fire || 0;
        entry.origin.water = (value as any).origin.water || 0;
        entry.origin.earth = (value as any).origin.earth || 0;
        entry.origin.air = (value as any).origin.air || 0;
        console.log(`LanguageData: Loaded origin for ${key}:`, {
          fire: entry.origin.fire,
          water: entry.origin.water,
          earth: entry.origin.earth,
          air: entry.origin.air
        });
      } else {
        console.log(`LanguageData: No origin data for ${key}`);
      }
      
      // Optional fields
      entry.spirit = (value as any).spirit || "";
      entry.weight = (value as any).weight || 0;
      
      // Composition (optional)
      if ((value as any).composition) {
        entry.composition.fire = (value as any).composition.fire || 0;
        entry.composition.water = (value as any).composition.water || 0;
        entry.composition.earth = (value as any).composition.earth || 0;
        entry.composition.air = (value as any).composition.air || 0;
      }
      
      // Spell effect (optional)
      if ((value as any).spell_effect) {
        entry.spell_effect.type = (value as any).spell_effect.type || "";
        entry.spell_effect.target = (value as any).spell_effect.target || "";
        entry.spell_effect.amount = (value as any).spell_effect.amount || "";
        entry.spell_effect.element = (value as any).spell_effect.element || "";
        entry.spell_effect.description = (value as any).spell_effect.description || "";
      }
      
      // Weapon effect (optional)
      if ((value as any).weapon_effect) {
        entry.weapon_effect.name = (value as any).weapon_effect.name || "";
        entry.weapon_effect.cost = (value as any).weapon_effect.cost || "";
        entry.weapon_effect.damage = (value as any).weapon_effect.damage || "";
        entry.weapon_effect.properties = (value as any).weapon_effect.properties || [];
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
