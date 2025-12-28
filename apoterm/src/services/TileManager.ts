import { Texture, Assets } from "pixi.js";
import { GAME_CONSTANTS } from "../../../shared/constants";

export interface TileAssets {
  floor: Texture;
  wall: Texture;
  player: Texture;
  enemy: Texture;
  item: Texture;
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
      
      // Load individual tiles based on the provided paths
      this.assets.floor = await Assets.load("/assets/tiles/dc-dngn/floor/sandstone_floor0.png");
      this.assets.wall = await Assets.load("/assets/tiles/dc-dngn/wall/brick_brown0.png");
      this.assets.player = await Assets.load("/assets/tiles/player/base/human_m.png");
      this.assets.enemy = await Assets.load("/assets/tiles/dc-mon/goblin.png");
      this.assets.item = await Assets.load("/assets/tiles/item/misc/misc_box.png");

      if (GAME_CONSTANTS.DEBUG) console.log("All tile assets loaded successfully!");
      this.loaded = true;
    } catch (error) {
      console.error("Failed to load tile assets:", error);
      // Create placeholder textures if assets fail to load
      this.createPlaceholderTextures();
    }
  }

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
