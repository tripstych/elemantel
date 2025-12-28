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
      
      // Handle origin (language_objects.json uses "origin" field)
      if ((value as any).origin) {
        entry.origin.fire = (value as any).origin.fire || 0;
        entry.origin.water = (value as any).origin.water || 0;
        entry.origin.earth = (value as any).origin.earth || 0;
        entry.origin.air = (value as any).origin.air || 0;
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

  loadFromLanguageData(languageData: any, itemTypes: { [type: string]: string[] }) {
    this.entries.clear();
    
    // Load items from language data based on type lists
    for (const [type, itemKeys] of Object.entries(itemTypes)) {
      for (const itemKey of itemKeys) {
        const languageEntry = languageData.entries.get(itemKey);
        if (languageEntry && languageEntry.weight > 0) {
          // Create a new LanguageEntry for ItemData
          const itemEntry = new LanguageEntry();
          itemEntry.word = languageEntry.word;
          itemEntry.definition = languageEntry.definition;
          itemEntry.spirit = languageEntry.spirit;
          itemEntry.weight = languageEntry.weight;
          itemEntry.type = type; // Use the type from the item file
          
          // Handle origin field
          console.log(`ItemData: Processing ${itemKey}, languageEntry.origin exists:`, !!languageEntry.origin);
          if (languageEntry.origin) {
            itemEntry.origin.fire = languageEntry.origin.fire || 0;
            itemEntry.origin.water = languageEntry.origin.water || 0;
            itemEntry.origin.earth = languageEntry.origin.earth || 0;
            itemEntry.origin.air = languageEntry.origin.air || 0;
          } else {
            console.warn(`ItemData: No origin data for ${itemKey}`);
          }
          
          // Handle spell_effect field
          if (languageEntry.spell_effect && typeof languageEntry.spell_effect === 'object') {
            itemEntry.spell_effect.type = String(languageEntry.spell_effect.type || "");
            itemEntry.spell_effect.amount = String(languageEntry.spell_effect.amount || "");
            itemEntry.spell_effect.target = String(languageEntry.spell_effect.target || "");
            itemEntry.spell_effect.element = String(languageEntry.spell_effect.element || "");
            itemEntry.spell_effect.description = String(languageEntry.spell_effect.description || "");
          }
          
          this.entries.set(itemKey, itemEntry);
        }
      }
    }
    
    console.log(`Loaded ${this.entries.size} items from ${Object.keys(itemTypes).length} type categories`);
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
      const elementalValue = entry.origin[element as keyof typeof entry.origin];
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
