import { send, ClientMessages } from "../utils/ClientSend";
import { RulesEngine, AttackResult, DamageResult } from "./RulesEngine";
import { Weapon } from "../schema/Equipment";
import { LanguageData } from "../schema/LanguageData";

export interface CombatEntity {
  name: string;
  combat_stats: {
    hp: number;
    max_hp: number;
    defense: number;
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
    proficiency_bonus: number;
  };
}

export interface CombatLog {
  message: string;
  damage?: number;
  target_hp?: number;
  is_critical?: boolean;
}

export class CombatCommand {
  /**
   * Resolve an attack from attacker to target using the specified weapon
   */
  static resolveAttack(
    attacker: CombatEntity, 
    defender: CombatEntity
  ): CombatLog {


      const executeAttack = (attacker, defender) => {
        // DAMAGE FORMULA:
        // (Weapon Damage + Strength Bonus) - (Armor Mitigation)
        // Strength Bonus = Strength / 4
        // Armor Mitigation = Armor / 2
        const weapon = (attacker.equipment.hand_slots.main_hand);

        const ld = new LanguageData();
        const ld_weapon = ld.getEntry(weapon);
        console.log(ld_weapon, weapon, '?');



        const strBonus = Math.floor(attacker.strength / 4);
        const rawPower = attacker.weaponDamage + attacker.strength;
        const mitigation = Math.floor(defender.armorDefense / 2);
        
        // Ensure damage is at least 1 so fights don't stall forever
        const finalDamage = Math.max(1, rawPower - mitigation);

        // Apply Damage
        defender.currentHp -= finalDamage;

        return {
            attacker: attacker.name,
            defender: defender.name,
            damageDealt: finalDamage,
            defenderRemainingHP: Math.max(0, defender.currentHp), // Don't show negative HP
            isFatal: defender.currentHp <= 0
        };
    };

      const attack = executeAttack(attacker, defender);
      console.log(attack,'attackack');
      
      return {
        message: `- placeholder message -`,
        is_critical: false
      };

  }

  /**
   * Check if an entity is defeated (HP <= 0)
   */
  static isDefeated(entity: CombatEntity): boolean {
    return entity.combat_stats.hp <= 0;
  }

  /**
   * Heal an entity by a specified amount, not exceeding max HP
   */
  static heal(entity: CombatEntity, amount: number): CombatLog {
    const currentHp = entity.combat_stats.hp;
    const maxHp = entity.combat_stats.max_hp;
    const actualHeal = Math.min(amount, maxHp - currentHp);
    
    entity.combat_stats.hp = Math.min(currentHp + amount, maxHp);

    return {
      message: `${entity.name} heals for ${actualHeal} HP.`,
      target_hp: entity.combat_stats.hp
    };
  }

  /**
   * Apply temporary hit points to an entity
   */
  static applyTempHp(entity: CombatEntity, tempHp: number): CombatLog {
    // Note: This would need to be added to the schema if not already present
    const currentTempHp = (entity.combat_stats as any).temporary_hp || 0;
    const newTempHp = Math.max(currentTempHp, tempHp);
    
    (entity.combat_stats as any).temporary_hp = newTempHp;

    return {
      message: `${entity.name} gains ${tempHp} temporary hit points.`
    };
  }

  /**
   * Calculate if an entity should make death saving throws
   */
  static needsDeathSave(entity: CombatEntity): boolean {
    return entity.combat_stats.hp === 0 && entity.combat_stats.max_hp > 0;
  }

  /**
   * Roll a death saving throw
   */
  static rollDeathSave(entity: CombatEntity): CombatLog {
    const roll = RulesEngine.roll64();
    const deathSaves = (entity.combat_stats as any).death_saves || { failures: 0, successes: 0 };
    
    if (roll.total === 64) {
      // Natural max: 1 HP and stand up
      entity.combat_stats.hp = 1;
      deathSaves.failures = 0;
      deathSaves.successes = 0;
      (entity.combat_stats as any).death_saves = deathSaves;
      
      return {
        message: `${entity.name} rolls a natural 64 on death save and returns to 1 HP!`,
        target_hp: 1
      };
    } else if (roll.total === 1) {
      // Natural 1: 2 failures
      deathSaves.failures += 2;
      (entity.combat_stats as any).death_saves = deathSaves;
      
      if (deathSaves.failures >= 3) {
        return {
          message: `${entity.name} rolls a natural 1 on death save and dies!`,
          target_hp: 0
        };
      }
      
      return {
        message: `${entity.name} rolls a natural 1 on death save (2 failures).`
      };
    } else if (roll.total >= 32) {
      // Success
      deathSaves.successes += 1;
      (entity.combat_stats as any).death_saves = deathSaves;
      
      if (deathSaves.successes >= 3) {
        return {
          message: `${entity.name} succeeds on death save and stabilizes!`
        };
      }
      
      return {
        message: `${entity.name} succeeds on death save (${roll.total}).`
      };
    } else {
      // Failure
      deathSaves.failures += 1;
      (entity.combat_stats as any).death_saves = deathSaves;
      
      if (deathSaves.failures >= 3) {
        return {
          message: `${entity.name} fails death save and dies!`,
          target_hp: 0
        };
      }
      
      return {
        message: `${entity.name} fails death save (${roll.total}).`
      };
    }
  }
}