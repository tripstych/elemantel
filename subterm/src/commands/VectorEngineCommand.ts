export interface ElementalVector {
  fire: number;
  water: number;
  earth: number;
  air: number;
}

export interface SpokenPhrase {
  phrase: string;
  words: string[];
  vectors: ElementalVector;
  totalStrain: number;  // Sum of abs(values) - the cost
  totalPower: number;   // Sum of signed values - the net effect
  unknownWords: string[];
}

export interface CastResult {
  success: boolean;
  message: string;
  load: number;
  strain: number;
  overload: number;
  burnDamage: number;
  vectors: ElementalVector;
  itemBefore?: Record<string, any>;
  itemAfter?: Record<string, any>;
}

export interface SyllableData {
  spelling: string;
  value: number;
  quality?: string;
  description?: string;
  alphabet: 'light' | 'dark';
  signedValue: number;
}

export interface ItemData {
  weight?: number;
  fire?: number;
  water?: number;
  earth?: number;
  air?: number;
  [key: string]: any;
}

export class VectorEngineCommand {
  private static readonly ELEMENTS = ['fire', 'water', 'earth', 'air'] as const;
  
  // word -> signed value (positive for light, negative for dark)
  private lexicon: Map<string, number> = new Map();
  // word -> element name
  private elementMap: Map<string, string> = new Map();
  // word -> 'light' or 'dark'
  private alphabetMap: Map<string, string> = new Map();

  // Raw syllable data by element and type
  private lightSyllables: Record<string, SyllableData[]> = {};
  private darkSyllables: Record<string, SyllableData[]> = {};

  constructor(
    private lightAlphabet: Record<string, SyllableData[]> = {},
    private darkAlphabet: Record<string, SyllableData[]> = {}
  ) {
    this.loadAlphabets();
  }

  private loadAlphabets(): void {
    // Load light alphabet (additive)
    for (const [element, syllables] of Object.entries(this.lightAlphabet)) {
      this.lightSyllables[element] = syllables.map(syl => ({
        ...syl,
        alphabet: 'light' as const,
        signedValue: syl.value // Positive for light
      }));

      for (const syllable of syllables) {
        const word = syllable.spelling.toUpperCase();
        const wordClean = word.replace(/-$/, '');

        this.lexicon.set(word, syllable.value);
        this.lexicon.set(wordClean, syllable.value);
        this.elementMap.set(word, element);
        this.elementMap.set(wordClean, element);
        this.alphabetMap.set(word, 'light');
        this.alphabetMap.set(wordClean, 'light');
      }
    }

    // Load dark alphabet (subtractive)
    for (const [element, syllables] of Object.entries(this.darkAlphabet)) {
      this.darkSyllables[element] = syllables.map(syl => ({
        ...syl,
        alphabet: 'dark' as const,
        signedValue: -syl.value // Negative for dark
      }));

      for (const syllable of syllables) {
        const word = syllable.spelling.toUpperCase();
        const wordClean = word.replace(/-$/, '');

        this.lexicon.set(word, -syllable.value);
        this.lexicon.set(wordClean, -syllable.value);
        this.elementMap.set(word, element);
        this.elementMap.set(wordClean, element);
        this.alphabetMap.set(word, 'dark');
        this.alphabetMap.set(wordClean, 'dark');
      }
    }
  }

  /**
   * Parse a spoken phrase into elemental vectors
   */
  parsePhrase(phrase: string): SpokenPhrase {
    const words = phrase.toUpperCase().split(/\s+/).filter(w => w.length > 0);
    const vectors: ElementalVector = { fire: 0, water: 0, earth: 0, air: 0 };
    let totalStrain = 0;
    let totalPower = 0;
    const unknownWords: string[] = [];

    for (const word of words) {
      // Try exact match first, then without trailing dash
      const wordClean = word.replace(/-$/, '');
      const lookup = this.lexicon.has(word) ? word : wordClean;

      if (this.lexicon.has(lookup)) {
        const signedValue = this.lexicon.get(lookup)!;
        const element = this.elementMap.get(lookup)!;

        // Vector gets the signed value (can go negative)
        vectors[element as keyof ElementalVector] += signedValue;

        // Strain is always the absolute magnitude
        totalStrain += Math.abs(signedValue);
        totalPower += signedValue;
      } else {
        unknownWords.push(word);
      }
    }

    return {
      phrase,
      words,
      vectors,
      totalStrain,
      totalPower,
      unknownWords
    };
  }

  /**
   * Calculate the LOAD for a spell cast
   * LOAD = total_strain * object_weight
   */
  calculateLoad(phrase: SpokenPhrase, itemWeight: number): number {
    return phrase.totalStrain * itemWeight;
  }

  /**
   * Cast a spoken spell on an item
   */
  cast(
    phrase: string,
    item: ItemData,
    casterConduit: number,
    casterHp: number
  ): CastResult {
    // Parse the phrase
    const parsed = this.parsePhrase(phrase);

    // Check for unknown words (fizzle)
    if (parsed.unknownWords.length > 0) {
      return {
        success: false,
        message: `Spell fizzled! Unknown syllables: ${parsed.unknownWords.join(', ')}`,
        load: 0,
        strain: parsed.totalStrain,
        overload: 0,
        burnDamage: 0,
        vectors: parsed.vectors
      };
    }

    // Check for empty phrase
    if (parsed.totalStrain === 0) {
      return {
        success: false,
        message: "No elemental words spoken!",
        load: 0,
        strain: 0,
        overload: 0,
        burnDamage: 0,
        vectors: parsed.vectors
      };
    }

    // Get item weight
    const itemWeight = item.weight || 1.0;

    // Calculate load from strain (absolute values)
    const load = this.calculateLoad(parsed, itemWeight);

    // Check for overload
    const overload = Math.max(0, load - casterConduit);
    const burnDamage = overload > 0 ? Math.floor(overload) : 0;

    // Store original item state
    const itemBefore = { ...item };

    // Apply transformation - add vector values to item stats
    // Values can be negative (dark alphabet subtracts)
    const itemAfter = { ...item };

    for (const element of VectorEngineCommand.ELEMENTS) {
      const current = itemAfter[element] || 0;
      const delta = parsed.vectors[element] || 0;
      const newValue = current + delta;
      // Prevent stats from going below 0
      itemAfter[element] = Math.max(0, newValue);
    }

    // Build result message
    let message: string;
    if (burnDamage > 0) {
      message = `OVERLOAD! Channeled ${phrase.toUpperCase()} but took ${burnDamage} burn damage!`;
    } else {
      message = `Cast ${phrase.toUpperCase()}! Strain: ${Math.floor(parsed.totalStrain)} Load: ${Math.floor(load)}/${casterConduit}`;
    }

    // Add transformation info
    const changes: string[] = [];
    for (const elem of VectorEngineCommand.ELEMENTS) {
      const delta = parsed.vectors[elem] || 0;
      if (delta > 0) {
        changes.push(`${elem.charAt(0).toUpperCase()}+${Math.floor(delta)}`);
      } else if (delta < 0) {
        changes.push(`${elem.charAt(0).toUpperCase()}${Math.floor(delta)}`);
      }
    }

    if (changes.length > 0) {
      message += ` [${changes.join(', ')}]`;
    }

    return {
      success: true,
      message,
      load,
      strain: parsed.totalStrain,
      overload,
      burnDamage,
      vectors: parsed.vectors,
      itemBefore,
      itemAfter
    };
  }

  /**
   * Get syllables for an element
   */
  getSyllablesForElement(element: string, alphabet?: 'light' | 'dark'): SyllableData[] {
    const result: SyllableData[] = [];

    if (!alphabet || alphabet === 'light') {
      if (this.lightSyllables[element]) {
        result.push(...this.lightSyllables[element]);
      }
    }

    if (!alphabet || alphabet === 'dark') {
      if (this.darkSyllables[element]) {
        result.push(...this.darkSyllables[element]);
      }
    }

    return result;
  }

  /**
   * Get only light (additive) syllables for an element
   */
  getLightSyllables(element: string): SyllableData[] {
    return this.getSyllablesForElement(element, 'light');
  }

  /**
   * Get only dark (subtractive) syllables for an element
   */
  getDarkSyllables(element: string): SyllableData[] {
    return this.getSyllablesForElement(element, 'dark');
  }

  /**
   * Get list of all elements
   */
  getAllElements(): string[] {
    const elements = new Set<string>();
    Object.keys(this.lightSyllables).forEach(e => elements.add(e));
    Object.keys(this.darkSyllables).forEach(e => elements.add(e));
    return Array.from(elements);
  }

  /**
   * Suggest a phrase to achieve target vectors within strain limit
   */
  suggestPhrase(
    targetVectors: Partial<ElementalVector>,
    maxStrain?: number,
    preferDark: boolean = false
  ): string {
    const phraseParts: string[] = [];
    let totalStrain = 0;

    // Sort elements by absolute target value (descending)
    const sortedTargets = Object.entries(targetVectors)
      .filter(([_, value]) => value !== undefined && value !== 0)
      .sort(([, a], [, b]) => Math.abs(b!) - Math.abs(a!));

    for (const [element, target] of sortedTargets) {
      if (target === 0 || target === undefined) continue;

      // Choose alphabet based on direction
      const useDark = target < 0;
      const syllables = this.getSyllablesForElement(element, useDark ? 'dark' : 'light');

      if (syllables.length === 0) continue;

      // Sort by value descending (absolute) for greedy approach
      const sortedSyllables = syllables.sort((a, b) => b.value - a.value);

      let remaining = Math.abs(target);
      for (const syllable of sortedSyllables) {
        if (remaining <= 0) break;

        const strainCost = syllable.value; // Always positive for strain

        if (maxStrain && totalStrain + strainCost > maxStrain) {
          continue;
        }

        while (remaining > 0 && (!maxStrain || totalStrain + strainCost <= maxStrain)) {
          phraseParts.push(syllable.spelling);
          remaining -= syllable.value;
          totalStrain += strainCost;
          if (remaining <= 0) break;
        }
      }
    }

    return phraseParts.join(' ');
  }

  /**
   * Get the dominant element from a vector
   */
  getDominantElement(vectors: ElementalVector): string | null {
    const maxVal = Math.max(...VectorEngineCommand.ELEMENTS.map(e => Math.abs(vectors[e])));
    if (maxVal === 0) return null;

    const dominants = VectorEngineCommand.ELEMENTS.filter(e => Math.abs(vectors[e]) === maxVal);
    return dominants.length === 1 ? dominants[0] : null;
  }

  /**
   * Create a default VectorEngine with sample syllable data
   */
  static createDefault(): VectorEngineCommand {
    // Sample light alphabet (additive)
    const lightAlphabet: Record<string, SyllableData[]> = {
      fire: [
        { spelling: "OOM", value: 1, quality: "spark", alphabet: "light", signedValue: 1 },
        { spelling: "KAI", value: 2, quality: "flame", alphabet: "light", signedValue: 2 },
        { spelling: "PYR", value: 4, quality: "inferno", alphabet: "light", signedValue: 4 },
        { spelling: "IGN", value: 8, quality: "blaze", alphabet: "light", signedValue: 8 },
        { spelling: "SOL", value: 16, quality: "solar", alphabet: "light", signedValue: 16 }
      ],
      water: [
        { spelling: "SHII", value: 1, quality: "drip", alphabet: "light", signedValue: 1 },
        { spelling: "AQU", value: 2, quality: "flow", alphabet: "light", signedValue: 2 },
        { spelling: "HYD", value: 4, quality: "wave", alphabet: "light", signedValue: 4 },
        { spelling: "MAR", value: 8, quality: "tide", alphabet: "light", signedValue: 8 },
        { spelling: "OCE", value: 16, quality: "ocean", alphabet: "light", signedValue: 16 }
      ],
      earth: [
        { spelling: "GRAV", value: 1, quality: "stone", alphabet: "light", signedValue: 1 },
        { spelling: "TERR", value: 2, quality: "rock", alphabet: "light", signedValue: 2 },
        { spelling: "GEOD", value: 4, quality: "boulder", alphabet: "light", signedValue: 4 },
        { spelling: "MONT", value: 8, quality: "mountain", alphabet: "light", signedValue: 8 },
        { spelling: "TUND", value: 16, quality: "tundra", alphabet: "light", signedValue: 16 }
      ],
      air: [
        { spelling: "VENT", value: 1, quality: "breeze", alphabet: "light", signedValue: 1 },
        { spelling: "AER", value: 2, quality: "wind", alphabet: "light", signedValue: 2 },
        { spelling: "GALE", value: 4, quality: "gust", alphabet: "light", signedValue: 4 },
        { spelling: "TEM", value: 8, quality: "storm", alphabet: "light", signedValue: 8 },
        { spelling: "CIEL", value: 16, quality: "sky", alphabet: "light", signedValue: 16 }
      ]
    };

    // Sample dark alphabet (subtractive)
    const darkAlphabet: Record<string, SyllableData[]> = {
      fire: [
        { spelling: "OOM-", value: 1, quality: "cold", alphabet: "dark", signedValue: -1 },
        { spelling: "KAI-", value: 2, quality: "freeze", alphabet: "dark", signedValue: -2 },
        { spelling: "PYR-", value: 4, quality: "ice", alphabet: "dark", signedValue: -4 },
        { spelling: "IGN-", value: 8, quality: "frost", alphabet: "dark", signedValue: -8 },
        { spelling: "SOL-", value: 16, quality: "winter", alphabet: "dark", signedValue: -16 }
      ],
      water: [
        { spelling: "SHII-", value: 1, quality: "dry", alphabet: "dark", signedValue: -1 },
        { spelling: "AQU-", value: 2, quality: "parch", alphabet: "dark", signedValue: -2 },
        { spelling: "HYD-", value: 4, quality: "desert", alphabet: "dark", signedValue: -4 },
        { spelling: "MAR-", value: 8, quality: "arid", alphabet: "dark", signedValue: -8 },
        { spelling: "OCE-", value: 16, quality: "waste", alphabet: "dark", signedValue: -16 }
      ],
      earth: [
        { spelling: "GRAV-", value: 1, quality: "dust", alphabet: "dark", signedValue: -1 },
        { spelling: "TERR-", value: 2, quality: "sand", alphabet: "dark", signedValue: -2 },
        { spelling: "GEOD-", value: 4, quality: "gravel", alphabet: "dark", signedValue: -4 },
        { spelling: "MONT-", value: 8, quality: "erosion", alphabet: "dark", signedValue: -8 },
        { spelling: "TUND-", value: 16, quality: "barren", alphabet: "dark", signedValue: -16 }
      ],
      air: [
        { spelling: "VENT-", value: 1, quality: "still", alphabet: "dark", signedValue: -1 },
        { spelling: "AER-", value: 2, quality: "calm", alphabet: "dark", signedValue: -2 },
        { spelling: "GALE-", value: 4, quality: "quiet", alphabet: "dark", signedValue: -4 },
        { spelling: "TEM-", value: 8, quality: "peace", alphabet: "dark", signedValue: -8 },
        { spelling: "CIEL-", value: 16, quality: "void", alphabet: "dark", signedValue: -16 }
      ]
    };

    return new VectorEngineCommand(lightAlphabet, darkAlphabet);
  }
}