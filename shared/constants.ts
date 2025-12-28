// Game constants shared across all components

export const GAME_CONSTANTS = {
  // Debug
  DEBUG: false,


  SCATTER_ITEMS: 20,

  SPAWN_MONSTERS: 10,
  
  // Movement and timing
  BASE_MOVE_INTERVAL: 100,
  WEIGHT_PENALTY_MS: 15,
  CARRY_WEIGHT_MULTIPLIER: 15 * 450,
  
  // Combat
  BASE_DAMAGE: 10,
  DAMAGE_VARIANCE: 5,
  TEMP_HP_DURATION: 60000, // 1 minute in ms
  
  // Pathfinding
  PATHFINDING_TIMEOUT: 5000,
  
  // UI
  MESSAGE_AUTO_HIDE: 5000,
  MAX_MESSAGES: 12,
  TILE_SIZE: 16,
  
  // Map tiles
  TILE_TYPES: {
    WALL: 1,
    FLOOR: 0,
    ROOM_FLOOR: 3,
    CORRIDOR: 4,
    ENTRANCE: 5,
    EXIT: 6
  },
  
  // Monster types
  MONSTER_TYPES: ['goblin', 'slime', 'orc', 'skeleton', 'troll'],
  
  // Equipment slots
  EQUIPMENT_SLOTS: {
    HAND: ['main_hand', 'off_hand'],
    BODY: ['head', 'face', 'neck', 'torso', 'back', 'waist', 'wrists', 'left_finger', 'right_finger', 'legs', 'feet']
  },
  
  // Colors (hex values)
  COLORS: {
    SUCCESS: 0x00ff66,
    WARNING: 0xffcc00,
    ERROR: 0xff4444,
    INFO: 0xffffff,
    DEBUG: 0x99ccff,
    LANGUAGE: 0xccccff
  }
};