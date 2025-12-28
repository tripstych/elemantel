import { Schema, type, MapSchema } from "@colyseus/schema";
import { LanguageEntry, ElementalOrigin } from "./LanguageData";
import { GAME_CONSTANTS } from "../../../shared/constants";

// ItemData schema - inherits structure from LanguageData but focused on physical items
export class ItemData extends Schema {
  @type({ map: LanguageEntry }) entries: MapSchema<LanguageEntry> = new MapSchema<LanguageEntry>();
  elementalDictionary: any = {};
  
  getEntry(key: string): LanguageEntry | undefined {
    if (GAME_CONSTANTS.DEBUG) {
      console.log("ItemData get Entry",key);
    }
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
  
  // General purpose query function
  query(filters: {
    type?: string;
    limit?: number;
    element?: string;
    hasSpellEffect?: boolean;
    customFilter?: (key: string, entry: LanguageEntry) => boolean;
  } = {}): Array<{key: string, entry: LanguageEntry}> {

    const limit = filters.limit ?? 10000;
    const results: Array<{ key: string, entry: LanguageEntry }> = [];

    for (const key in this.elementalDictionary) {
      const entry = this.elementalDictionary[key] as LanguageEntry;

      let matches = true;
      if (filters.type && entry.type !== filters.type) {
        matches = false;
      }
      if (filters.element) {
        const elementalValue = (entry.origin as any)[filters.element];
        if (!(typeof elementalValue === 'number' && elementalValue > 0)) {
          matches = false;
        }
      }
      if (filters.hasSpellEffect !== undefined) {
        const hasEffect = !!(entry as any).spell_effect?.type;
        if (filters.hasSpellEffect !== hasEffect) {
          matches = false;
        }
      }
      if (filters.customFilter && !filters.customFilter(key, entry)) {
        matches = false;
      }

      if (matches) {
        results.push({ key, entry });
        if (results.length >= limit) { break; }
      }
    }

    return results;
    
  }
  
  // Item-specific methods
  getItemsByType(itemType: string): Array<{key: string, entry: LanguageEntry}> {
    const results: Array<{key: string, entry: LanguageEntry}> = [];
    
    // console.log(itemType,'searching for itemType')
    for (const [key, entry] of this.entries.entries()) {
      // console.log('entry',entry)
      if (entry.type === itemType) {
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
