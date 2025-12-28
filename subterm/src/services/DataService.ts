import path from "path";
import { promises as fsp } from "fs";
import { LanguageData } from "../schema/LanguageData";

export interface LoadedData {
  elementalLightAlphabet: any | null;
  elementalDarkAlphabet: any | null;
  elementalDictionary: any | null;
  itemTypes: { [type: string]: string[] };
}

/**
 * DataService loads and caches game JSON data asynchronously.
 * It resolves paths relative to the workspace root (../data from subterm/src).
 */
export class DataService {
  private dataDir: string;
  private loaded: boolean = false;
  private cache: LoadedData = {
    elementalLightAlphabet: null,
    elementalDarkAlphabet: null,
    elementalDictionary: null,
    itemTypes: {}
  };

  constructor(dataDir?: string) {
    // Resolve to workspace-level /data folder: subterm/src/services -> ../../../data
    this.dataDir = dataDir || path.resolve(__dirname, "../../..", "data");
  }

  async ensureLoaded(): Promise<void> {
    if (this.loaded) return;

    const readJson = async (filename: string) => {
      const filePath = path.join(this.dataDir, filename);
      try {
        const buf = await fsp.readFile(filePath, "utf8");
        return JSON.parse(buf);
      } catch (err) {
        console.warn(`[DataService] Failed to read ${filename} at ${filePath}:`, err);
        return null;
      }
    };

    // Load core language datasets
    const [light, dark, dict] = await Promise.all([
      readJson("elemental_light_alphabet.json"),
      readJson("elemental_dark_alphabet.json"),
      readJson("elemental_dictionary.json")
    ]);

    this.cache.elementalLightAlphabet = light;
    this.cache.elementalDarkAlphabet = dark;
    this.cache.elementalDictionary = dict;

    // Load item type lists (item_*_synsets.json)
    this.cache.itemTypes = await this.loadItemTypeFiles();

    this.loaded = true;
  }

  private async loadItemTypeFiles(): Promise<{ [type: string]: string[] }> {
    const result: { [type: string]: string[] } = {};
    try {
      const entries = await fsp.readdir(this.dataDir);
      const files = entries.filter(f => f.startsWith("item_") && f.endsWith("_synsets.json"));

      await Promise.all(files.map(async (file) => {
        const type = file.replace("item_", "").replace("_synsets.json", "");
        const arr = await this.readArrayFile(file);
        if (arr && Array.isArray(arr)) {
          result[type] = arr;
        }
      }));
    } catch (err) {
      console.warn("[DataService] Failed to load item type files:", err);
    }
    return result;
  }

  private async readArrayFile(filename: string): Promise<any[] | null> {
    const filePath = path.join(this.dataDir, filename);
    try {
      const buf = await fsp.readFile(filePath, "utf8");
      const json = JSON.parse(buf);
      return Array.isArray(json) ? json : null;
    } catch (err) {
      console.warn(`[DataService] Failed to read array file ${filename} at ${filePath}:`, err);
      return null;
    }
  }

  getData(): LoadedData {
    return this.cache;
  }

  createLanguageData(): LanguageData | null {
    const { elementalDictionary } = this.cache;
    if (!elementalDictionary) return null;
    const ld = new LanguageData();
    ld.loadFromJSON(elementalDictionary);
    return ld;
  }

  getSavePath(): string {
    return path.join(this.dataDir, "save.json");
  }
}
