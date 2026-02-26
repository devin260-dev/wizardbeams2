import { BALANCE } from '../data/BalanceConfig.js';

export class ElementSystem {
  // School RPS matchup: returns 'advantage', 'same', 'disadvantage', or 'neutral'
  static getSchoolMatchup(schoolA, schoolB) {
    if (!schoolA || !schoolB || schoolA === 'neutral' || schoolB === 'neutral') return 'neutral';
    if (schoolA === schoolB) return 'same';
    if (BALANCE.school.counter_map[schoolA] === schoolB) return 'advantage';
    if (BALANCE.school.counter_map[schoolB] === schoolA) return 'disadvantage';
    return 'neutral';
  }
}
