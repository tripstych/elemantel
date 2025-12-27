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
   * Roll a d20, with optional advantage/disadvantage.
   * Returns { total, is_critical } where is_critical is true on natural 20
   */
  static rollD20(advantage: boolean = false, disadvantage: boolean = false): { total: number; is_critical: boolean } {
    if (advantage && disadvantage) {
      advantage = disadvantage = false;
    }

    if (advantage) {
      const a = this.randomInt(1, 20);
      const b = this.randomInt(1, 20);
      const pick = Math.max(a, b);
      return { total: pick, is_critical: pick === 20 };
    } else if (disadvantage) {
      const a = this.randomInt(1, 20);
      const b = this.randomInt(1, 20);
      const pick = Math.min(a, b);
      return { total: pick, is_critical: pick === 20 };
    } else {
      const roll = this.randomInt(1, 20);
      return { total: roll, is_critical: roll === 20 };
    }
  }

  /**
   * Calculate ability modifier from ability score
   */
  static getAbilityMod(score: number): number {
    return Math.floor((score - 10) / 2);
  }

  /**
   * Calculate initiative: d20 + Dexterity modifier
   */
  static calculateInitiative(stats: CombatStats): number {
    const d20 = this.rollD20().total;
    const dexMod = this.getAbilityMod(stats.dexterity);
    return d20 + dexMod;
  }

  /**
   * Determine attack modifier and ability for a weapon
   */
  static getAttackModForWeapon(attackerStats: CombatStats, weapon: Weapon): { mod: number; ability: string } {
    const strMod = this.getAbilityMod(attackerStats.strength);
    const dexMod = this.getAbilityMod(attackerStats.dexterity);
    const props = (weapon.properties || []).map(p => p.toLowerCase());

    if (props.includes("ranged")) {
      return { mod: dexMod, ability: "dexterity" };
    }
    if (props.includes("finesse")) {
      // Choose the higher of STR/DEX for finesse
      if (dexMod >= strMod) {
        return { mod: dexMod, ability: "dexterity" };
      }
      return { mod: strMod, ability: "strength" };
    }
    return { mod: strMod, ability: "strength" };
  }

  /**
   * Roll an attack: d20 + ability mod (from weapon) + proficiency
   */
  static rollAttack(
    attackerStats: CombatStats,
    targetStats: CombatStats,
    weapon: Weapon
  ): AttackResult {
    const { mod } = this.getAttackModForWeapon(attackerStats, weapon);
    const d20 = this.rollD20();
    const total = d20.total + mod + attackerStats.proficiency_bonus;
    const hit = total >= targetStats.armor_class;
    
    return {
      hit,
      is_critical: d20.is_critical,
      roll_total: total
    };
  }

  /**
   * Roll weapon damage dice (double dice on crit) and add the appropriate ability modifier
   */
  static rollDamage(attackerStats: CombatStats, weapon: Weapon, isCrit: boolean = false): DamageResult {
    const diceMatch = weapon.damage_dice.trim().match(/(\d+)[dD](\d+)/);
    if (!diceMatch) {
      throw new Error(`Invalid dice string: ${weapon.damage_dice}`);
    }

    let count = parseInt(diceMatch[1]);
    const sides = parseInt(diceMatch[2]);

    if (isCrit) {
      count *= 2;
    }

    let total = 0;
    for (let i = 0; i < count; i++) {
      total += this.randomInt(1, sides);
    }

    const { mod } = this.getAttackModForWeapon(attackerStats, weapon);
    total += mod;

    return { damage: total };
  }

  /**
   * Simple random integer generator (in production, use a better RNG)
   */
  private static randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}