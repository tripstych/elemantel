import { Texture, Assets } from "pixi.js";
import { ASSET_URLS } from "../assetsManifest";
import { GAME_CONSTANTS } from "../../../shared/constants";

export interface TileAssets {
  floor: Texture;
  wall: Texture;
  player: Texture;
  enemy: Texture;
  item: Texture;
  hpbar: Texture;
}

export class TileManager {
  private static instance: TileManager;
  private assets: Partial<TileAssets> = {};
  private loaded = false;

  private constructor() {}

  static getInstance(): TileManager {
    if (!TileManager.instance) {
      TileManager.instance = new TileManager();
    }
    return TileManager.instance;
  }

  async loadAssets(): Promise<void> {
    if (this.loaded) return;

    try {
      if (GAME_CONSTANTS.DEBUG) console.log("Loading tile assets...");
      
      // Discover assets via generated manifest
      const urls = (ASSET_URLS || []) as string[];
      const pick = (predicate: (u: string) => boolean) => urls.find(u => predicate(u.toLowerCase()));

      const floorUrl = pick(u => u.includes("floor") && (u.includes("sand") || u.includes("stone") || u.includes("floor")));
      const wallUrl = pick(u => u.includes("wall"));
      const playerUrl = pick(u => u.includes("player") && (u.includes("human") || u.includes("huaman") || u.includes("base")));
      const enemyUrl = pick(u => u.includes("goblin") || u.includes("enemy") || u.includes("monster"));
      const itemUrl = pick(u => u.includes("item") && (u.includes("misc") || u.includes("box") || u.includes("gem") || u.includes("weapon")));
      const hpBarUrl = pick(u => u.includes("hp_bar")) || "/assets/HP_bar.png";

      this.assets.floor = floorUrl ? await Assets.load(floorUrl) : Texture.EMPTY;
      this.assets.wall = wallUrl ? await Assets.load(wallUrl) : Texture.EMPTY;
      this.assets.player = playerUrl ? await Assets.load(playerUrl) : Texture.EMPTY;
      this.assets.enemy = enemyUrl ? await Assets.load(enemyUrl) : Texture.EMPTY;
      this.assets.item = itemUrl ? await Assets.load(itemUrl) : Texture.EMPTY;
      this.assets.hpbar = hpBarUrl ? await Assets.load(hpBarUrl) : Texture.EMPTY;

      if (GAME_CONSTANTS.DEBUG) console.log("All tile assets loaded successfully!");
      this.loaded = true;
    } catch (error) {
      console.error("Failed to load tile assets:", error);
      // Create placeholder textures if assets fail to load
      this.createPlaceholderTextures();
    }
  }

  // No-op: manifest-driven loading now used

  private createPlaceholderTextures(): void {
    if (GAME_CONSTANTS.DEBUG) console.log("Creating placeholder textures...");
    
    // Create simple colored rectangles as placeholders
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;

    // Floor placeholder (light gray)
    ctx.fillStyle = '#d4d4d4';
    ctx.fillRect(0, 0, 32, 32);
    this.assets.floor = Texture.from(canvas);

    // Wall placeholder (dark gray)
    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect(0, 0, 32, 32);
    this.assets.wall = Texture.from(canvas);

    // Player placeholder (blue)
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(0, 0, 32, 32);
    this.assets.player = Texture.from(canvas);

    // Enemy placeholder (red)
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(0, 0, 32, 32);
    this.assets.enemy = Texture.from(canvas);

    // Item placeholder (yellow)
    ctx.fillStyle = '#eab308';
    ctx.fillRect(0, 0, 32, 32);
    this.assets.item = Texture.from(canvas);

    // HP bar placeholder (red strip)
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(0, 0, 32, 3);
    this.assets.hpbar = Texture.from(canvas);

    this.loaded = true;
  }

  getAsset(type: keyof TileAssets): Texture {
    if (!this.loaded) {
      if (GAME_CONSTANTS.DEBUG) console.warn("Assets not loaded yet, returning empty texture");
      return Texture.EMPTY;
    }

    const asset = this.assets[type];
    if (!asset) {
      if (GAME_CONSTANTS.DEBUG) console.warn(`Asset ${type} not found, returning empty texture`);
      return Texture.EMPTY;
    }

    return asset;
  }

  isLoaded(): boolean {
    return this.loaded;
  }
}

export const tileManager = TileManager.getInstance();
