// Data loading utilities for shared /data folder
export async function loadJsonData(filename: string): Promise<any> {
  try {
    const response = await fetch(`/data/${filename}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    console.log(`Loaded ${filename} from /data/`);
    return data;
  } catch (error) {
    console.error(`Error loading ${filename}:`, error);
    return null;
  }
}

// Pre-loaded data cache
let dataCache: any = {};

export async function getGameData(filename: string): Promise<any> {
  if (!dataCache[filename]) {
    dataCache[filename] = await loadJsonData(filename);
  }
  return dataCache[filename];
}

// Available data files
export const DATA_FILES = {
  ELEMENTAL_DARK_ALPHABET: 'elemental_dark_alphabet.json',
  ELEMENTAL_DICTIONARY: 'elemental_dictionary.json',
  ELEMENTAL_LIGHT_ALPHABET: 'elemental_light_alphabet.json'
} as const;
