import { Schema, type, MapSchema } from "@colyseus/schema";
import { LanguageEntry, ElementalOrigin } from "./LanguageData";

// ItemData schema - inherits structure from LanguageData but focused on physical items
export class ItemData extends Schema {
  @type({ map: LanguageEntry }) entries: MapSchema<LanguageEntry> = new MapSchema<LanguageEntry>();
  
  loadFromJSON(jsonData: any) {
    this.entries.clear();
    for (const [key, value] of Object.entries(jsonData)) {
      // Only load entries that have weight data (physical items)
      if (!(value as any).weight || (value as any).weight <= 0) continue;
      
      const entry = new LanguageEntry();
      entry.word = (value as any).word || "";
      entry.definition = (value as any).definition || "";
      entry.spirit = (value as any).spirit || "";
      entry.weight = (value as any).weight || 0;
      entry.type = (value as any).type || "";
      
      // Handle elemental_origin (language_objects.json uses "origin" field)
      if ((value as any).origin) {
        entry.elemental_origin.fire = (value as any).origin.fire || 0;
        entry.elemental_origin.water = (value as any).origin.water || 0;
        entry.elemental_origin.earth = (value as any).origin.earth || 0;
        entry.elemental_origin.air = (value as any).origin.air || 0;
      }
      
      // Handle composition as ElementalOrigin object (if present)
      if ((value as any).composition) {
        entry.composition.fire = (value as any).composition.fire || 0;
        entry.composition.water = (value as any).composition.water || 0;
        entry.composition.earth = (value as any).composition.earth || 0;
        entry.composition.air = (value as any).composition.air || 0;
      }
      
      // Handle spell_effect (if item has magical properties)
      if ((value as any).spell_effect) {
        entry.spell_effect.type = String((value as any).spell_effect.type || "");
        entry.spell_effect.amount = String((value as any).spell_effect.amount || "");
      }
      
      this.entries.set(key, entry);
    }
  }
  
  getEntry(key: string): LanguageEntry | undefined {
    return this.entries.get(key);
  }
  
  searchEntries(query: string): Array<{key: string, entry: LanguageEntry}> {
    const results: Array<{key: string, entry: LanguageEntry}> = [];
    const lowerQuery = query.toLowerCase();
    
    for (const [key, entry] of this.entries.entries()) {
      if (entry.word.toLowerCase().includes(lowerQuery) ||
          entry.definition.toLowerCase().includes(lowerQuery) ||
          entry.type.toLowerCase().includes(lowerQuery)) {
        results.push({ key, entry });
      }
    }
    
    return results;
  }
  
  // Item-specific methods
  getItemsByType(itemType: string): Array<{key: string, entry: LanguageEntry}> {
    const results: Array<{key: string, entry: LanguageEntry}> = [];
    
    for (const [key, entry] of this.entries.entries()) {
      if (entry.type === itemType) {
        results.push({ key, entry });
      }
    }
    
    return results;
  }  
  getItemsByWeight(minWeight: number, maxWeight?: number): Array<{key: string, entry: LanguageEntry}> {
    const results: Array<{key: string, entry: LanguageEntry}> = [];
    
    for (const [key, entry] of this.entries.entries()) {
      if (entry.weight >= minWeight && (!maxWeight || entry.weight <= maxWeight)) {
        results.push({ key, entry });
      }
    }
    
    return results;
  }
  
  getItemsByElement(element: string): Array<{key: string, entry: LanguageEntry}> {
    const results: Array<{key: string, entry: LanguageEntry}> = [];
    
    for (const [key, entry] of this.entries.entries()) {
      const elementalValue = entry.elemental_origin[element as keyof typeof entry.elemental_origin];
      if (typeof elementalValue === 'number' && elementalValue > 0) {
        results.push({ key, entry });
      }
    }
    
    return results;
  }
  
  getMagicalItems(): Array<{key: string, entry: LanguageEntry}> {
    const results: Array<{key: string, entry: LanguageEntry}> = [];
    
    for (const [key, entry] of this.entries.entries()) {
      if (entry.spell_effect.type) {
        results.push({ key, entry });
      }
    }
    
    return results;
  }
  
  getMundaneItems(): Array<{key: string, entry: LanguageEntry}> {
    const results: Array<{key: string, entry: LanguageEntry}> = [];
    
    for (const [key, entry] of this.entries.entries()) {
      if (!entry.spell_effect.type) {
        results.push({ key, entry });
      }
    }
    
    return results;
  }
}
