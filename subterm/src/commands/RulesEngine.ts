import { send, ClientMessages } from "../utils/ClientSend";
import { CombatStats } from "../schema/CombatStats";
import { Weapon, DamageType } from "../schema/Equipment";

export interface AttackResult {
  hit: boolean;
  is_critical: boolean;
  roll_total: number;
}

export interface DamageResult {
  damage: number;
}

export class RulesEngine {
  /**
   * Roll a d64, with optional advantage/disadvantage.
   * Returns { total, is_critical } where is_critical is true on natural 64
   */
  static roll64(advantage: boolean = false, disadvantage: boolean = false): { total: number; is_critical: boolean } {
    if (advantage && disadvantage) {
      advantage = disadvantage = false;
    }

    if (advantage) {
      const a = this.randomInt(1, 64);
      const b = this.randomInt(1, 64);
      const pick = Math.max(a, b);
      return { total: pick, is_critical: pick === 64 };
    } else if (disadvantage) {
      const a = this.randomInt(1, 64);
      const b = this.randomInt(1, 64);
      const pick = Math.min(a, b);
      return { total: pick, is_critical: pick === 64 };
    } else {
      const roll = this.randomInt(1, 64);
      return { total: roll, is_critical: roll === 64 };
    }
  }

  /**
   * Calculate ability modifier from ability score on 1-64 scale
   */
  static getAbilityMod(score: number): number {
    return Math.floor((score - 32) / 8);
  }

  /**
   * Calculate initiative: d64 + Dexterity modifier
   */
  static calculateInitiative(stats: CombatStats): number {
    const roll = this.roll64().total;
    const dexMod = this.getAbilityMod(stats.dexterity);
    return roll + dexMod;
  }

  /**
   * Determine attack modifier and ability for a weapon (unused in flat system)
   */
  static getAttackModForWeapon(attackerStats: CombatStats, weapon: Weapon): { mod: number; ability: string } {
    return { mod: 0, ability: "flat" };
  }

  /**
   * Roll an attack: d64 vs defender's armor_class (no ability/proficiency mods)
   */
  static rollAttack(
    attackerStats: CombatStats,
    targetStats: CombatStats,
    weapon: Weapon
  ): AttackResult {
    const roll = this.roll64();
    const total = roll.total;
    const hit = total >= targetStats.armor_class;
    
    return {
      hit,
      is_critical: roll.is_critical,
      roll_total: total
    };
  }

  /**
   * Roll weapon damage with crit multiplier (no ability modifier)
   */
  static rollDamage(attackerStats: CombatStats, weapon: Weapon, isCrit: boolean = false): DamageResult {
    const baseDamage = Math.max(0, weapon.damage || 0);
    const critMultiplier = isCrit ? 2 : 1;
    const total = Math.max(0, baseDamage * critMultiplier);

    return { damage: total };
  }

  /**
   * Simple random integer generator (in production, use a better RNG)
   */
  private static randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}