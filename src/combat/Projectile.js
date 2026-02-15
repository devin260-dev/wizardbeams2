import { BALANCE } from '../data/BalanceConfig.js';

const SPELL_COLORS = {
  fire: '#ff4400',
  water: '#0088ff',
  earth: '#8b5e3c',
  air: '#eeeeff',
  '': '#aaaaaa',
};

export class Projectile {
  constructor(startX, startY, targetX, targetY, speed, spellData, targetNodeId, owner) {
    this.x = startX;
    this.y = startY;
    this.targetX = targetX;
    this.targetY = targetY;
    this.speed = speed;
    this.spellData = spellData;
    this.targetNodeId = targetNodeId;
    this.owner = owner; // 'player' or 'enemy'
    this.arrived = false;

    const dx = targetX - startX;
    const dy = targetY - startY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    this.dirX = dist > 0 ? dx / dist : 0;
    this.dirY = dist > 0 ? dy / dist : 0;
    this.totalDist = dist;
    this.traveled = 0;
  }

  update(dt) {
    if (this.arrived) return;
    const move = this.speed * dt;
    this.x += this.dirX * move;
    this.y += this.dirY * move;
    this.traveled += move;
    if (this.traveled >= this.totalDist) {
      this.x = this.targetX;
      this.y = this.targetY;
      this.arrived = true;
    }
  }

  hasArrived() {
    return this.arrived;
  }

  render(renderer) {
    if (this.arrived) return;
    const color = SPELL_COLORS[this.spellData.element] || SPELL_COLORS[''];
    const size = this.spellData.id === 'fireball' ? 6 : (this.spellData.id === 'earth_barrage' ? 4 : 5);
    renderer.drawCircle(this.x, this.y, size, color);
    // Trail
    renderer.drawCircle(this.x - this.dirX * 4, this.y - this.dirY * 4, size * 0.6, color, 0.4);
  }
}
