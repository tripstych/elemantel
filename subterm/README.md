# Backend Overview (subterm)

This backend is a Colyseus server providing multiplayer game services for Elemantel. It includes a `MyRoom` implementation, world generation, combat and pathfinding helpers, language/item data ingestion, and a small Express layer for monitoring and playground.

## Quick Start

```
npm start
# in a second terminal
npm run loadtest
```

Tests:

```
npm test
```

## Entry Points & Server Setup

- [src/index.ts](src/index.ts): boots the Colyseus server via `@colyseus/tools` and listens on 2567.
- [src/app.config.ts](src/app.config.ts): registers room handlers and wires Express routes:
    - `/hello_world`: simple health route
    - `/monitor`: Colyseus monitor (protect in production)
    - `/` playground (dev-only)

## Rooms & Game Flow

- [src/rooms/MyRoom.ts](src/rooms/MyRoom.ts): the primary room implementation.
    - Initializes `MyRoomState` and generates a dungeon.
    - Loads language and item synset data from the top-level `data` folder.
    - Handles client messages: `move`, `attack`, `cast_spell`, `pickup`, `drop_item`, `equip`, `unequip`, `auto_navigate`, `get_language_*`, `save_game`, `load_game`.
    - Provides simple monster spawning and chase AI, pathfinding for auto-navigation, and save/load to `data/save.json`.

## Schemas

- Room-local schemas: [src/rooms/schema/MyRoomState.ts](src/rooms/schema/MyRoomState.ts)
    - `GameMap`: flat tile array (`tiles: ArraySchema<number>`)
    - `PlayerState`: core stats + equipment slot groups
    - `Item`: name/type/value/weight
    - `MyRoomState`: `map`, single `player`, `players` (unused), and `world` (`MapSchema<Item>` keyed by `"x,y"`)

- Shared schemas: [src/schema](src/schema)
    - `GameMap` uses row-based tiles (`ArraySchema<TileRow>`), includes `entrance`, `exit`, `tile_constants`.
    - `GameState`: `map`, `player`, `entities` (`ArraySchema<MonsterState>`), `world` map.
    - `PlayerState`, `MonsterState`, `CombatStats`, `Equipment` (e.g., `Weapon`), `LanguageData`, `ItemData`.

Note: There are two map/player schema families in use (room-local vs shared). See “Code Smells” for consolidation guidance.

## Commands & Services

- Commands:
    - [src/commands/WorldGenerationCommand.ts](src/commands/WorldGenerationCommand.ts): BSP dungeon generation + enemy/item scattering (both schema and plain-data variants).
    - [src/commands/PathfinderCommand.ts](src/commands/PathfinderCommand.ts): A*, BFS, Dijkstra pathfinding.
    - [src/commands/AICommand.ts](src/commands/AICommand.ts): simple monster chase turns.
    - [src/commands/PlayerCommands.ts](src/commands/PlayerCommands.ts): movement, equip/unequip, spell parsing & casting.
    - [src/commands/CombatCommand.ts](src/commands/CombatCommand.ts) with [src/commands/RulesEngine.ts](src/commands/RulesEngine.ts): attack rolls, damage, death saves.
    - [src/commands/VectorEngineCommand.ts](src/commands/VectorEngineCommand.ts): elemental syllable parsing, strain/load/overload, item transformation.

- Services:
    - [src/services/DungeonGenerator.ts](src/services/DungeonGenerator.ts): BSP/cellular/drunkard/rooms+corridors generation with tile constants and conversion to Colyseus-friendly grids.

## Data Ingestion

- Language and item synsets loaded from top-level [data](../data) JSON files.
- `MyRoom` reads `elemental_*_alphabet.json`, `elemental_dictionary.json`, and item type lists (e.g., `item_*_synsets.json`).

## Networking Messages (selected)

- Movement: `move { dx, dy, attack? }` with inventory-weight movement interval.
- Combat: `attack { targetX, targetY }`, `spacebar_attack_result` for AoE adjacent tiles.
- Spells: `cast_spell { spellName, targetX, targetY }`.
- Inventory: `pickup`, `drop_item`, `equip { slotPath, itemName }`, `unequip { slotPath }`.
- Navigation: `auto_navigate { targetX, targetY, moveInterval }` returns `path` and steps.
- Language: `get_language_data`, `search_language { query }`, `get_language_entry { key }`.
- Persistence: `save_game`, `load_game` to `data/save.json`.

## Code Smells & Risks

- Duplicate schemas: `LanguageData`/`PlayerState`/`GameMap` are defined both in room-local and shared schema folders, with different structures (flat vs row-based tiles). Increases drift and bugs.
- Inconsistent map representation: some systems assume `tiles: number[]` (flat), others use `TileRow` arrays. Walkable tiles sets vary per file and may not align with generated grids.
- Synchronous filesystem I/O in room handlers: `fs.readFileSync` and `fs.readdirSync` during `onCreate` can block the event loop and degrade latency under load.
- Ad-hoc `require()` usage in TypeScript handlers: mixed ESM/CommonJS calls for `fs`/`path` inside message handlers (`save_game`, `load_game`) increases inconsistency.
- Inline fallback schemas: `MyRoom.ts` defines an inline `LanguageData` set “to avoid import issues”, which hides real type differences and invites data mismatch.
- Excessive logging: many `console.log`/`console.warn` and `[DEBUG]` lines in hot paths (movement, item scatter, AI) will spam logs and impact performance.
- Magic numbers: movement interval penalty uses arbitrary constants (`strength * 15 * 450`, `+15ms/kg`) without clear balance rationale; monster caps and item counts are hardcoded.
- Unused state: `players: MapSchema<PlayerState>` exists in `MyRoomState` but all logic uses single `player`.
- Fragile path handling: `../../../data` relative paths from room code are brittle across build/packaging; saving to `../../data/save.json` may not exist in production.
- Incomplete type safety on messages: message payloads are `any`, no runtime validation or TypeScript discriminated unions.
- Divergent item world model: `WorldGenerationCommand` sometimes stores arrays of items per tile, while `MyRoom` stores a single `Item` per `"x,y"` key. Semantics differ.

## Recommendations

- Consolidate schemas: remove room-local schema duplicates; standardize on shared `schema/` and one `GameMap` representation (pick row-based `TileRow` for efficiency and clarity).
- Unify walkable tiles: define a single `const WALKABLE = new Set([...])` exported from a central module and use everywhere.
- Async data preloading: load dictionaries and synsets at process startup (outside rooms) using async `fs/promises`; inject into rooms via `app.config` or a service singleton.
- Fix imports: use ESM imports consistently; avoid `require()` inside handlers; move save/load to a dedicated persistence service with validated paths.
- Reduce logging noise: add a simple logger with levels; trim debug logs in hot paths; gate verbose logs behind `NODE_ENV!=='production'`.
- Message typing: add TypeScript types for each message shape; validate payloads server-side (e.g., zod) before acting.
- Item/world model: choose one representation (single `Item` vs array per tile) and apply consistently across room and commands.
- Remove unused state: drop `players` or implement multi-player logic against it; set `maxClients` in `app.config` as needed.
- Configurable generation: surface `seed`, `algorithm`, counts in config; prefer seeded RNG for reproducibility.
- Pathfinding reuse: have `MyRoom` call `PathfinderCommand` for A*; avoid re-implementing pathfinding.

## Project Structure

- Core:
    - [src/index.ts](src/index.ts)
    - [src/app.config.ts](src/app.config.ts)
- Rooms:
    - [src/rooms/MyRoom.ts](src/rooms/MyRoom.ts)
    - [src/rooms/schema/MyRoomState.ts](src/rooms/schema/MyRoomState.ts)
- Commands:
    - [src/commands/WorldGenerationCommand.ts](src/commands/WorldGenerationCommand.ts)
    - [src/commands/PathfinderCommand.ts](src/commands/PathfinderCommand.ts)
    - [src/commands/AICommand.ts](src/commands/AICommand.ts)
    - [src/commands/PlayerCommands.ts](src/commands/PlayerCommands.ts)
    - [src/commands/CombatCommand.ts](src/commands/CombatCommand.ts)
    - [src/commands/RulesEngine.ts](src/commands/RulesEngine.ts)
    - [src/commands/VectorEngineCommand.ts](src/commands/VectorEngineCommand.ts)
- Schemas:
    - [src/schema](src/schema)
- Services:
    - [src/services/DungeonGenerator.ts](src/services/DungeonGenerator.ts)
- Tests:
    - [test/MyRoom_test.ts](test/MyRoom_test.ts)

## License

UNLICENSED (see package.json)
