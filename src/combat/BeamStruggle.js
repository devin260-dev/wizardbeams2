import { BALANCE } from '../data/BalanceConfig.js';

export class BeamStruggle {
  constructor(combatState, eventBus, playerNetwork, enemyNetwork, playerChanneling, enemyChanneling, elementSystem) {
    this.state = combatState;
    this.eventBus = eventBus;
    this.playerNetwork = playerNetwork;
    this.enemyNetwork = enemyNetwork;
    this.playerChanneling = playerChanneling;
    this.enemyChanneling = enemyChanneling;
    this.elementSystem = elementSystem;
  }

  getEffectiveMana(side) {
    const sideState = this.state[side];
    const network = side === 'player' ? this.playerNetwork : this.enemyNetwork;
    const channeling = side === 'player' ? this.playerChanneling : this.enemyChanneling;

    let mana = network.getNodeMana();
    mana += 1; // element attunement bonus
    if (channeling) {
      mana -= channeling.getContinuousManaCost();
    }
    mana -= this._getCounterDebuff(side);
    mana += sideState.panic_mana_bonus || 0;
    return mana; // can be negative
  }

  _getCounterDebuff(side) {
    const sideState = this.state[side];
    const otherSide = side === 'player' ? 'enemy' : 'player';
    const otherState = this.state[otherSide];
    const otherNetwork = side === 'player' ? this.enemyNetwork : this.playerNetwork;

    const mySchool = sideState.current_beam_school;
    const theirSchool = otherState.current_beam_school;

    if (mySchool === 'neutral' || theirSchool === 'neutral') return 0;

    // Check if their beam beats my beam
    const counterMap = BALANCE.school.counter_map;
    if (counterMap[theirSchool] === mySchool) {
      // I'm being countered
      if (otherNetwork.allManaNodesActive()) {
        return BALANCE.school.counter_debuff_max;
      }
      return BALANCE.school.counter_debuff;
    }
    return 0;
  }

  update(dt) {
    if (this.state.combat_over) return;

    const playerMana = this.getEffectiveMana('player');
    const enemyMana = this.getEffectiveMana('enemy');

    // Store for HUD display
    this.state.player.effective_mana = playerMana;
    this.state.enemy.effective_mana = enemyMana;

    const manaDiff = playerMana - enemyMana;

    // Element multiplier
    const elementMult = this.elementSystem.getElementMultiplier(
      this.state.player.dominant_element,
      this.state.enemy.dominant_element
    );

    const pushForce = manaDiff * BALANCE.beam.push_rate * elementMult * dt;
    this.state.collision_point = Math.max(0, Math.min(100, this.state.collision_point + pushForce));

    // Win check
    if (this.state.collision_point >= 100) {
      this.state.combat_over = true;
      this.state.combat_result = 'player_win';
      this.eventBus.emit('beam_overwhelm', { winner: 'player' });
    } else if (this.state.collision_point <= 0) {
      this.state.combat_over = true;
      this.state.combat_result = 'enemy_win';
      this.eventBus.emit('beam_overwhelm', { winner: 'enemy' });
    }
  }

  render(renderer) {
    const playerPos = BALANCE.wizard.player_position;
    const enemyPos = BALANCE.wizard.enemy_position;
    const staffOffset = BALANCE.wizard.staff_tip_offset;
    const beamY = 540 / 2 + BALANCE.wizard.beam_y_offset;

    const playerStaffX = playerPos.x + staffOffset.x;
    const enemyStaffX = enemyPos.x - staffOffset.x; // mirrored

    // Collision point in screen space
    const collisionX = playerStaffX + (enemyStaffX - playerStaffX) * (this.state.collision_point / 100);

    const playerMana = this.state.player.effective_mana || 0;
    const enemyMana = this.state.enemy.effective_mana || 0;
    const maxMana = BALANCE.beam.max_mana;

    const playerThickness = this._getBeamThickness(playerMana, maxMana);
    const enemyThickness = this._getBeamThickness(enemyMana, maxMana);

    // Draw player beam
    this._drawBeam(renderer, playerStaffX, beamY, collisionX, beamY,
      playerThickness, this.state.player.current_beam_school);

    // Draw enemy beam
    this._drawBeam(renderer, enemyStaffX, beamY, collisionX, beamY,
      enemyThickness, this.state.enemy.current_beam_school);

    // Collision orb
    const orbSize = 6 + Math.sin(performance.now() / 200) * 2;
    renderer.drawCircle(collisionX, beamY, orbSize, '#ffff88');
    renderer.drawCircle(collisionX, beamY, orbSize * 0.6, '#ffffff');
  }

  _getBeamThickness(mana, maxMana) {
    const t = Math.max(0, Math.min(1, mana / maxMana));
    return BALANCE.beam.beam_min_thickness + (BALANCE.beam.beam_max_thickness - BALANCE.beam.beam_min_thickness) * t;
  }

  _drawBeam(renderer, x1, y1, x2, y2, thickness, school) {
    const colorData = BALANCE.school.colors[school] || BALANCE.school.colors.neutral;
    const color = colorData.hex;
    const halfThick = thickness / 2;

    if (school === 'order') {
      // Wavy sine-wave edges
      this._drawWavyBeam(renderer, x1, y1, x2, y2, halfThick, color);
    } else if (school === 'chaos') {
      // Jagged edges
      this._drawJaggedBeam(renderer, x1, y1, x2, y2, halfThick, color);
    } else {
      // Straight rectangle (pure/neutral)
      const alpha = school === 'neutral' ? 0.5 : 0.8;
      renderer.drawRect(Math.min(x1, x2), y1 - halfThick,
        Math.abs(x2 - x1), thickness, color, alpha);
    }
  }

  _drawWavyBeam(renderer, x1, y1, x2, y2, halfThick, color) {
    const len = Math.abs(x2 - x1);
    const dir = x2 > x1 ? 1 : -1;
    const segments = Math.max(1, Math.floor(len / 8));
    const topPoints = [];
    const botPoints = [];

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = x1 + len * dir * t;
      const wave = Math.sin(t * Math.PI * 4 + performance.now() / 300) * 3;
      topPoints.push({ x, y: y1 - halfThick + wave });
      botPoints.push({ x, y: y1 + halfThick - wave });
    }

    const allPoints = [...topPoints, ...botPoints.reverse()];
    renderer.drawFilledPolygon(allPoints, color, 0.8);
  }

  _drawJaggedBeam(renderer, x1, y1, x2, y2, halfThick, color) {
    const len = Math.abs(x2 - x1);
    const dir = x2 > x1 ? 1 : -1;
    const segments = Math.max(1, Math.floor(len / 12));
    const topPoints = [];
    const botPoints = [];

    // Use seeded pseudo-random for consistent jags per frame
    let seed = Math.floor(performance.now() / 100);
    const pseudoRandom = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return (seed % 100) / 100;
    };

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = x1 + len * dir * t;
      const jag = (pseudoRandom() - 0.5) * 6;
      topPoints.push({ x, y: y1 - halfThick + jag });
      botPoints.push({ x, y: y1 + halfThick + jag });
    }

    const allPoints = [...topPoints, ...botPoints.reverse()];
    renderer.drawFilledPolygon(allPoints, color, 0.8);
  }
}
