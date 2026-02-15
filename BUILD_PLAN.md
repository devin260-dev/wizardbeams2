# Wizard Beams — HTML5 Prototype Build Plan v2

## Overview

This document is the complete build plan for the Wizard Beams HTML5 prototype. It is designed to be followed sequentially by Claude Code (or any developer) from start to finish. The prototype will be built with **vanilla JavaScript + HTML5 Canvas**, using ES6 classes that mirror Godot's node/scene architecture for a clean future port.

**Tech Stack:** Vanilla JS, ES6 modules, HTML5 Canvas, no frameworks
**Deployment:** GitHub → Vercel (static site)
**Architecture Pattern:** Class-based, mimicking Godot's scene tree (each class = future GDScript)
**Reference Document:** Wizard Beams GDD v3 (FINAL) — source of truth for all game mechanics

---

## Architecture Principles

### 1. Godot-Portable Class Structure
Every class maps 1:1 to a future Godot node/script:

```
wizard-beams/
├── index.html                  # Entry point, canvas element
├── src/
│   ├── main.js                 # Game initialization, scene management
│   ├── core/
│   │   ├── GameLoop.js         # requestAnimationFrame loop, delta time
│   │   ├── SceneManager.js     # Switches between screens (map, combat, menus)
│   │   ├── InputManager.js     # Mouse/keyboard input, click detection
│   │   └── EventBus.js         # Pub/sub for decoupled communication
│   ├── data/
│   │   ├── BalanceConfig.js    # ALL balance variables in one place
│   │   ├── SpellDatabase.js    # Spell definitions
│   │   ├── GemDatabase.js      # Gem generation rules
│   │   └── EnemyDatabase.js    # Enemy tier templates
│   ├── combat/
│   │   ├── CombatScreen.js     # Combat scene root, orchestrates all combat systems
│   │   ├── BeamStruggle.js     # Collision point, push force, beam rendering
│   │   ├── BeamSwitcher.js     # Beam school switching (charge, lock, forced neutral)
│   │   ├── ElementSystem.js    # Dominant element calculation, shift delay, matchups
│   │   ├── StabilitySystem.js  # Stability drain/regen/punishment
│   │   ├── ShieldSystem.js     # Shield toggle, recharge, projectile blocking
│   │   ├── NodeNetwork.js      # 13 nodes, adjacency, awareness, state management
│   │   ├── NodeRenderer.js     # Draws the chakra figure + nodes
│   │   ├── ChannelingSystem.js # Open → Channeled, beam lockout, mana cost
│   │   ├── SpellCaster.js      # Spell activation, targeting, cooldowns
│   │   ├── Projectile.js       # Spell projectile travel + impact
│   │   ├── CombatHUD.js        # All combat UI elements
│   │   ├── CombatAI.js         # Enemy decision-making
│   │   └── CombatState.js      # Central combat state object
│   ├── meta/
│   │   ├── MapScreen.js        # Branching map rendering + navigation
│   │   ├── MapGenerator.js     # Procedural tier/node generation
│   │   ├── LoadoutScreen.js    # Gem arrangement between fights
│   │   ├── MerchantScreen.js   # Buy gems with gold
│   │   ├── ShrineScreen.js     # Pick 1 of 3 gems
│   │   ├── RestScreen.js       # Heal or upgrade choice
│   │   ├── EventScreen.js      # Mystery node events
│   │   └── RunState.js         # Persistent run data
│   └── rendering/
│       ├── Renderer.js         # Canvas context wrapper, coordinate helpers
│       ├── SpriteManager.js    # Placeholder sprite/shape rendering
│       └── UIComponents.js     # Reusable buttons, bars, pip displays
├── package.json
├── vercel.json
└── README.md
```

### 2. Data-Driven Balance
**ALL numeric values live in `BalanceConfig.js`**. No magic numbers in game logic. Every system reads from this config. This makes tuning trivial and maps directly to Godot's export variables.

### 3. Central State Objects
Two state objects hold all runtime data:
- **`RunState`** — persists across the entire run (HP, gold, gems, attunements, map progress)
- **`CombatState`** — exists only during a fight (collision point, stability, beam state, node states, channeled spells)

**Convention:** The **update order in CombatScreen** is the source of truth for state consistency. Systems read from CombatState directly during their `update(dt)` calls — this is safe because the update order guarantees each system sees the correct state from earlier systems. The EventBus is used for **cross-cutting reactions** that don't fit the update order (e.g., `beam_node_damaged` triggering a forced Neutral, `spell_hit` triggering shield absorption). EventBus listeners should be limited to triggering state transitions, not reading complex derived state — keep event payloads simple (node ID, spell ID, damage amount) and let the next update cycle handle downstream effects.

### 4. Event Bus for Decoupling
Systems communicate through an EventBus (pub/sub) rather than direct references:
- `node_damaged` → StabilitySystem, BeamSwitcher, ElementSystem respond
- `spell_hit` → ShieldSystem, StabilitySystem, HP system respond
- `beam_switched` → BeamStruggle, CombatHUD update
- `spell_channeled` → ChannelingSystem, BeamSwitcher respond

This maps to Godot's signal system.

---

## Build Order

The build proceeds in layers. Each layer depends on the one before it.

---

### LAYER 0 — Foundation

#### 0.1 `index.html`
- Single HTML file with a `<canvas>` element at 960×540
- CSS scales canvas to 1920×1080 (2×) with `image-rendering: pixelated`
- `<script type="module" src="./src/main.js">`
- Black background, centered canvas

#### 0.2 `core/GameLoop.js`
- `requestAnimationFrame` loop
- Calculates `delta_time` in seconds
- Calls `update(dt)` and `render(ctx)` on the active scene
- Tracks elapsed time

#### 0.3 `core/InputManager.js`
- Listens to canvas `mousedown`, `mouseup`, `mousemove`, `keydown`
- Converts mouse coordinates to game space (divides by 2 for the CSS scale)
- Provides `isMouseDown()`, `getMousePos()`, `wasKeyPressed(key)`, `wasClicked()` (true for one frame after mouseup)
- Click detection helper: `isPointInRect(x, y, rect)`, `isPointInCircle(x, y, cx, cy, r)`
- `resetFrame()` — called at start of each update to clear per-frame flags

#### 0.4 `core/EventBus.js`
- Simple pub/sub: `on(event, callback)`, `emit(event, data)`, `off(event, callback)`
- Used by all systems to communicate without direct references
- No async — all callbacks fire synchronously in emit order

#### 0.5 `core/SceneManager.js`
- Holds reference to active scene
- `changeScene(sceneName, data)` — switches scenes, calls `exit()` on old and `enter(data)` on new
- Each scene implements: `enter(data)`, `exit()`, `update(dt)`, `render(ctx)`

#### 0.6 `rendering/Renderer.js`
- Wraps canvas context
- Helper methods: `drawRect`, `drawCircle`, `drawLine`, `drawPolyline`, `drawText`, `drawBar`, `clear`
- Coordinate system: all in 960×540 game space

#### 0.7 `rendering/UIComponents.js`
- `Button` class: rect + text + click detection + hover state + disabled state
- `ProgressBar` class: horizontal bar with fill percentage + color
- `PipBar` class: FTL-style HP pips (individual rectangles)
- `Label` class: positioned text with font size, color, alignment

#### 0.8 `data/BalanceConfig.js`
- Single exported object containing EVERY balance variable from the GDD
- Organized by system with dot notation: `BALANCE.beam.push_rate`, `BALANCE.shield.mana_cost`, `BALANCE.spells.grey_bolt.cooldown`
- Includes floor values for passive stat stacking: `BALANCE.floors.awareness_speed = 100`, etc.
- Includes all enemy tier stats
- **This file must be complete before any game logic is written**

#### 0.9 `main.js`
- Creates canvas (960×540), gets 2D context
- Instantiates GameLoop, InputManager, EventBus (as shared singletons or passed via dependency injection)
- Creates SceneManager, registers all scenes
- Starts GameLoop
- Initial scene: StartScreen (Layer 7) — use a temporary test scene until then

---

### LAYER 1 — Combat State & Node Network

#### 1.1 `data/SpellDatabase.js`
- Array of spell definitions, each with: `id`, `name`, `element`, `school`, `is_projectile`, `node_effect` ("damaged" or "dormant"), `mana_cost` (continuous while channeled), `cooldown`, `travel_speed`, `hp_damage`, and spell-specific fields
- Includes Grey Bolt, Shield, Fireball, Earth Barrage, Air Choke, Water Beam
- All numeric values read from BalanceConfig

#### 1.2 `data/GemDatabase.js`
- `createGreyBolt()` — returns starting Grey Bolt gem (neutral, no element)
- `createShieldGem()` — returns starting Shield gem (neutral, no element, inherits dominant)
- `createGem(element, school, passiveStat, spellId)` — generic gem constructor
- `generateRandomGem(tier)` — for merchant/rewards, random element + school + passive, chance of spell
- Passive stat pool with values from BalanceConfig
- Each gem gets a unique `id` (use incrementing counter or UUID)

#### 1.3 `data/EnemyDatabase.js`
- `generateEnemy(tier, isElite, isBoss)` — returns EnemyData
- Random school and element attunement generation
- Beam types unlocked: always includes attuned type, additional randomly selected per tier count
- Assigns Grey Bolt gem to all enemies
- Assigns Shield gem to tier 2+ enemies (per `has_shield` flag)
- Assigns random spell gems based on tier gem count
- **Gem slot assignment:** shuffle all assigned gems and place randomly into the 7 gem slot nodes
- Elite modifier application (HP bonus, awareness speed bonus, extra gem)

#### 1.4 `combat/CombatState.js`
- Class holding ALL combat runtime state for BOTH sides
- Player state: beam school, beam switch state/timer/target, stability, node states array, channeled gem list, locked beam types, dominant element + shift timer + pending element
- Enemy state: identical mirror structure
- Collision point: float
- `reset(runState, enemyData)` — initializes a fresh fight
  - Player: all nodes Dormant except attuned beam node (Open), no channeled spells, stability 100%, collision 50
  - Enemy: same rules, using enemy attunement
  - Enemy boss: all_nodes_open flag sets all enemy nodes to Open

#### 1.5 `combat/NodeNetwork.js`
**Core class.** Used for both player and enemy (instantiated twice).

Constructor takes `is_enemy` flag for mirrored positioning.

**Node definitions:**
- 7 gem slot nodes (Crown, Third Eye, Throat, L Shoulder, R Shoulder, L Root, R Root) — **can be activated even without a gem slotted** for +1 mana. Gems add passive bonuses and spells on top.
- 3 beam type nodes (Belly/Pure, L Hand/Chaos, R Hand/Order)
- 3 pathway nodes (Sternum, L Elbow, R Elbow) — transit only, no mana, no gems
- Adjacency list as defined in GDD
- Positions from GDD (mirrored horizontally for enemy)

**State management:**
- `getState(nodeId)` → NodeState enum
- `setState(nodeId, newState)` — also emits `node_state_changed` event
- `damageNode(nodeId)` — sets to Damaged (from projectile or stability punishment)
- `disruptNode(nodeId)` — sets to Dormant (from non-projectile spells)

**Awareness system:**
- `currentNode`, `targetNode`, `travelProgress`
- `setTarget(nodeId)` — starts BFS pathfinding, begins travel
- `update(dt)` — moves awareness along path, progresses activation/repair timers when awareness is at a node
- **Auto-repair on transit:** When awareness reaches a Damaged node on its travel path, it automatically begins repairing that node (spending `node_repair_time`). Awareness resumes travel after the repair completes. This prevents network softlocks from damaged pathway nodes.
- Travel time per hop: base value modified by passive bonuses (with floor)

**Queries:**
- `getOpenNodes()`, `getChanneledNodes()`, `getDamagedNodes()`, `getDormantNodes()`
- `getEffectiveMana()` — counts Open + Channeled nodes (each +1)
- `getElementCounts()` — counts elements from **Open nodes only** (not Channeled)
- `getGemAtNode(nodeId)` → GemData or null
- `getNodesByType(type)` — filter by gem_slot, beam_type, pathway
- `isNodeOpen(nodeId)` → bool

**Click detection:**
- `getNodeAtPoint(x, y)` — returns nodeId if click is within node radius, null otherwise
- Node clickable radius: ~12px (base resolution)

#### 1.6 `combat/NodeRenderer.js`
- Draws the meditation silhouette (prototype: simple geometric stick figure)
- Draws nodes as circles:
  - Dormant: dim grey
  - Open: bright color (element-tinted)
  - Channeled: pulsing bright with spell icon
  - Damaged: red with crack/X
- Draws connections as lines between adjacent nodes (dim lines)
- Draws awareness indicator (glowing white dot, animated travel between nodes)
- Draws activation/repair progress (circular arc around node)
- Draws gem element icon on slotted nodes (small colored dot: red=fire, blue=water, brown=earth, white=air)
- Takes NodeNetwork as input, handles mirroring for enemy

---

### LAYER 2 — Beam Struggle Core

#### 2.1 `combat/BeamStruggle.js`
- Owns collision point (0–100), reads from CombatState
- `update(dt)`:
  - Gets player effective mana (NodeNetwork.getEffectiveMana() + attunement bonus − channeled spell costs − counter debuff)
  - Gets enemy effective mana (same calculation)
  - Counter debuff is evaluated **continuously** by comparing both wizards' active beam schools each frame
  - Gets element multiplier from ElementSystem
  - Calculates push force, updates collision point
  - Clamps collision point to [0, 100]
  - Emits `beam_overwhelm` if collision reaches 0 or 100
- `render(ctx)`:
  - Draws two beams from wizard staff tips to collision point
  - Beam thickness: `lerp(min, max, clamp(effective_mana / 11, 0, 1))` — max mana is 11
  - Beam color from school_colors
  - Beam outline pattern:
    - Order: generate sine-wave edge points along beam, draw as polyline
    - Chaos: generate jagged random edge points, draw as polyline
    - Pure/Neutral: draw as rectangle
  - Collision orb at meeting point (white/yellow glowing circle)

#### 2.2 `combat/BeamSwitcher.js`
- State machine: `ready` → `charging` → `locked`
- Three flows:
  - **Attack switch:** `ready` → `charging` (2s, old beam fires) → new beam activates → `locked` (5s)
  - **Voluntary neutral:** instant switch, 10% stability damage, `locked` (2s)
  - **Forced neutral:** instant switch, 40% stability damage, `locked` (2s). Triggered by misfire or beam node loss.
- `requestSwitch(school)`:
  - Checks if locked → reject
  - Checks if beam node is Open → reject if not
  - Checks if school is in locked_beam_types → reject
  - If switching to Neutral: instant, apply stability, lock for 2s
  - If switching to attack: begin charging state
- `forcedNeutral()`: called by ChannelingSystem on misfire or NodeNetwork on beam node damage
- `update(dt)` — progresses charge/lock timers
- Emits: `beam_switch_started`, `beam_switch_completed`, `forced_neutral`

#### 2.3 `combat/ElementSystem.js`
- `recalculate(nodeNetwork, attunement)`:
  - Counts elements from Open nodes + attunement bonus
  - If result differs from current dominant, starts 2s shift delay
- `update(dt)`:
  - Progresses shift delay timer
  - When timer expires, updates dominant element in CombatState
- `getMatchup(elementA, elementB)` → "winner_a", "winner_b", or "neutral"
  - Implements Fire > Earth > Air > Water > Fire
- `getElementMultiplier(playerElement, enemyElement)` → 1.0 or element_push_multiplier
- `getSpellStabilityDamage(spellElement, defenderElement, shieldUp)` → percentage
  - No element (Grey Bolt/Shield): always neutral matchup
  - For projectiles blocked by shield: `shieldUp` should be `false` (shield broke before element check)
  - For non-projectiles mitigated by shield: `shieldUp` is `true`
  - Returns 0% (non-projectile + defender advantage + shield up), 10% (neutral or defender advantage), or 40% (attacker advantage)

#### 2.4 `combat/StabilitySystem.js`
- Reads current beam school from CombatState
- `update(dt)`:
  - If on Neutral: drain stability at 25%/s
  - If on attack beam: regen stability at 25%/s
  - Clamp to [0, 100]
  - If stability hits 0: trigger punishment
- `applyDamage(percent)` — instant stability reduction
- `applyDrain(percent, duration)` — gradual drain (for Air Choke/Water Beam vs shield), tracked as active drain
- Punishment: pick random undamaged functional node → damage it, reset stability to 100%
- Emits: `stability_punishment`, `stability_changed`

---

### LAYER 3 — Shield & Channeling

#### 3.1 `combat/ShieldSystem.js`
- **Only functional when Shield Gem is Channeled** — check ChannelingSystem state
- States: `unavailable` (not channeled), `down`, `up`, `recharging`
- `toggleShield()`:
  - If not channeled → reject
  - If down → raise (set to up)
  - If up → lower (set to down)
  - If recharging → lower (cancel recharge, set to down)
- `canBlock(spell)` → true if shield is `up` AND spell is projectile
- `absorbHit()` → set to `recharging`, start recharge timer
- `update(dt)` — progress recharge timer, auto-restore to `up` when complete
- When Shield Gem is un-channeled: shield state resets to `unavailable`
- Emits: `shield_broke`, `shield_restored`, `shield_state_changed`

#### 3.2 `combat/ChannelingSystem.js`
- Manages Open → Channeled transitions
- `requestChannel(gemId)`:
  - Check gem's node is Open → reject if not
  - Check max_channeled_spells limit → reject if at max
  - Check if channeling would lock out current beam type → trigger forced Neutral via BeamSwitcher, then proceed
  - Start channel_time timer (1.5s)
  - When timer completes: set node to Channeled, add to channeled list, apply beam lockout, **begin continuous mana cost deduction**
- `requestUnchannel(gemId)`:
  - Instant: set node to Open, remove from channeled list, remove lockout, **stop mana cost**
  - If gem is Shield Gem: also reset shield state to unavailable
- `getLockedBeamTypes()` → array of school strings locked by currently channeled gems
- `getContinuousManaCoast()` → sum of all channeled spell mana_costs
- `update(dt)` — progress channel timers for pending channels
- Emits: `spell_channeled`, `spell_unchanneled`, `misfire`

---

### LAYER 4 — Spells & Projectiles

#### 4.1 `combat/Projectile.js`
- Individual projectile instance
- Properties: start position, target position (node center), speed, spell data, target node id, owner (player/enemy)
- `update(dt)` — moves toward target at speed
- `hasArrived()` — true when within 2px of target
- `render(ctx)` — draw as colored circle/shape moving across screen
  - Color based on spell element (red=fire, brown=earth, white=air, blue=water, grey=none)

#### 4.2 `combat/SpellCaster.js`
- Manages spell casting flow for both player and enemy
- Tracks: active projectiles array, targeting mode, cooldowns per spell
- `enterTargeting(spellId)` — enters targeting mode for a specific spell
- `cancelTargeting()` — exits targeting mode
- `castSpell(spellId, targetData)`:
  - Check spell is Channeled → reject
  - Check cooldown → reject if on cooldown
  - Start cooldown timer
  - Create projectile(s) or apply immediate effect:
    - **Grey Bolt:** single Projectile toward target node
    - **Fireball:** single Projectile toward circle center, on arrival check all nodes within radius
    - **Earth Barrage:** spawn N Projectiles toward target node with slight visual stagger (`earth_stagger_delay` between arrivals). Each rock resolves sequentially: (1) if shield is up and rock hasn't been shield-blocked yet, roll `earth_hit_chance` — success means shield absorbs this rock (shield breaks, only first rock can be blocked); (2) roll `earth_hit_chance` for node hit — success means target node → Damaged + HP damage + element stability check. Each successful node hit triggers a **separate** element check.
    - **Air Choke:** immediate effect, no projectile. Check shield state. Shield down: set Crown, Third Eye, Throat to Dormant. Shield up: apply stability drain.
    - **Water Beam:** immediate effect, no projectile. Click-target a single enemy node. Check shield state. Shield down: target node + 2 nodes along BFS path toward nearest Root go Dormant. Shield up: apply stability drain. Path resolution: BFS from target toward nearest Root node, flood follows shortest path for 2 hops.
  - **On projectile arrival / immediate effect:**
    1. Check ShieldSystem.canBlock() for projectiles
    2. If blocked: shield absorbs hit (shield enters recharging/down state), then run element check against **shield-down** state
    3. If not blocked: apply node_effect ("damaged" or "dormant"), apply HP damage
    4. Run element check: ElementSystem.getSpellStabilityDamage(spell.element, defender.dominant_element, shield_up) — note: for blocked projectiles, shield_up is false since shield just broke
    5. Apply element stability damage to defender via StabilitySystem (stacks with spell-specific stability)
- `update(dt)` — move all active projectiles, check arrivals, tick cooldowns
- `render(ctx)` — draw all active projectiles, draw targeting overlay if in targeting mode
  - Fireball targeting: translucent circle following mouse over enemy node network
  - Water Beam targeting: highlight target node + preview flood path (2 nodes toward root)

---

### LAYER 5 — Combat HUD & AI

#### 5.1 `combat/CombatHUD.js`
- Renders all combat UI using UIComponents:
  - **Beam type buttons** (Order/Chaos/Pure/Neutral): show charge timer, lock timer, disabled if locked out or node not Open
  - **Spell buttons** for each gem slot: show if Open (channel button), Channeled (cast button + cooldown), or unavailable
  - **Shield toggle button**: only active when Shield Gem is Channeled, shows shield state
  - **Mana display**: number showing effective mana (with breakdown on hover: base − costs)
  - **HP pip bars**: player (left) and enemy (right)
  - **Stability bar**: colored bar with percentage
  - **Element indicator**: colored icon showing current dominant element, pending shift indicator
  - **Beam switch timer**: visual indicator during charge/lock
- Click handling: routes HUD clicks to appropriate systems (BeamSwitcher, ChannelingSystem, SpellCaster, ShieldSystem)
- Layout: HUD elements along edges of screen, not overlapping node networks or beam

#### 5.2 `combat/CombatAI.js`
- Enemy decision-making, evaluated on a timer (`enemy_ai_decision_interval`)
- **NOT** run every frame — runs every ~1 second, with tier-dependent reaction delays

**Awareness AI priority queue:**
1. Repair Damaged functional nodes (prioritize nodes that had gems with spells)
2. Activate Dormant gem slot nodes (prioritize spell gem nodes)
3. Activate Dormant beam type nodes (to unlock more beam options)
4. If all nodes are Open or Channeled: stay at current node

After arriving at a node, wait `decision_delay` (tier-dependent) before picking next target.

**Beam AI decision tree:**
```
if being_countered AND stability > 50%:
    switch to Neutral (voluntary)
    after lock expires, switch to counter of player's beam
elif can_counter(player_beam) AND beam_not_locked:
    begin switch to counter beam
elif current_beam_locked_out:
    switch to any available attack beam
else:
    stay on current beam
```
- Reaction time: delay between player switching and AI responding (tier-dependent)
- Respects charge time and lock duration

**Shield AI:**
```
if has_shield_gem AND shield_gem_not_channeled:
    if effective_mana >= 3:
        channel Shield Gem
if shield_channeled AND shield_down:
    if enemy_has_spell_channeled:
        raise shield
```

**Spell AI:**
```
if grey_bolt_not_channeled:
    if stability > 50% AND effective_mana >= 3:
        channel Grey Bolt
if grey_bolt_channeled:
    if effective_mana < 2:
        unchannel Grey Bolt (need mana for beam)
    elif grey_bolt_cooldown_ready AND interval_elapsed:
        pick target: weighted random from (spell_gem_nodes: 3x, beam_type_nodes: 2x, other_open_nodes: 1x)
        cast Grey Bolt at target
```

#### 5.3 `combat/CombatScreen.js`
- **Combat scene root.** Creates and orchestrates all combat systems.
- `enter(data)`:
  - Receives `{ runState, enemyData }`
  - Creates CombatState, initializes from RunState + EnemyData
  - Creates two NodeNetworks (player + enemy)
  - Creates all subsystems, passes shared references (CombatState, EventBus, both NodeNetworks)
- `update(dt)` — systems update in this **exact order:**
  1. InputManager.resetFrame()
  2. CombatAI (enemy decisions — runs on its own timer, not every frame)
  3. NodeNetwork — player (awareness travel, activation/repair timers)
  4. NodeNetwork — enemy (same)
  5. ChannelingSystem — player (process pending channels, mana cost tracking)
  6. ChannelingSystem — enemy (same)
  7. BeamSwitcher — player (charge/lock timers)
  8. BeamSwitcher — enemy (same)
  9. ElementSystem — player (dominant element shift delay)
  10. ElementSystem — enemy (same)
  11. StabilitySystem — player (drain/regen, active drains, punishment)
  12. StabilitySystem — enemy (same)
  13. ShieldSystem — player (recharge timer)
  14. ShieldSystem — enemy (same)
  15. SpellCaster (cooldowns, projectile movement, impact resolution — handles both sides)
  16. BeamStruggle (push force, collision point, win check)
  17. CombatHUD (update button states, displays)
- `render(ctx)` — draw in this order (back to front):
  1. Background (solid dark color or gradient)
  2. Wizard placeholder sprites (player left at 86,236 — enemy right at 874,236)
  3. Beams (from staff tips to collision point)
  4. Collision orb
  5. Node networks (player lower-left, enemy lower-right mirrored)
  6. Projectiles in flight
  7. HUD (on top)
  8. Targeting overlays (fireball circle, water beam line)
- Win/lose detection: checks `beam_overwhelm` event and HP ≤ 0
- On combat end: package results (gold, gem offerings), transition to PostCombatScreen
- `exit()` — cleanup, unsubscribe events

---

### LAYER 6 — Meta Game

#### 6.1 `meta/RunState.js`
- Persistent run data class
- Properties: school_attunement, element_attunement, hp, max_hp, gold, gems array, gem_slots dict, current_tier, map_data, current_node_id
- Methods:
  - `startNewRun(school, element)` — reset all, create Grey Bolt + Shield Gem
  - `addGem(gem)`, `removeGem(gemId)` — inventory management
  - `slotGem(gemId, nodeId)`, `unslotGem(nodeId)` — loadout management
  - `spendGold(amount)`, `addGold(amount)`
  - `heal(percent)`, `takeDamage(amount)`

#### 6.2 `meta/MapGenerator.js`
- Generates a 3-tier branching map **(prototype placeholder — constraints are loose, just make something playable)**
- Uses this algorithm:

**Algorithm:**
```
For each tier (1-3):
  1. Generate N nodes (random between min and max per tier)
  2. Arrange in a column with vertical spacing
  3. Connect to previous tier:
     - Each node connects forward to 1-2 nodes in next tier
     - Each node must have at least 1 incoming connection (except tier 1)
     - Each node must have at least 1 outgoing connection (except tier 3)
  4. Assign node types with constraints:
     - At least 2 duels per tier
     - Exactly 1 elite per tier (on a branch that can be avoided)
     - At most 1 mystery per tier
     - At least 1 rest site or merchant per tier
     - Remaining nodes: random from (duel, rest, merchant, shrine)
  5. Tier 3 final node is always Archmage (boss)
  6. Some non-adjacent nodes start as hidden ('?')
  7. Generate enemy data for all duel/elite/boss nodes
```
- Returns MapData: array of MapNodes with positions, types, connections

#### 6.3 `meta/MapScreen.js`
- Renders branching map: nodes as labeled circles/icons, connections as lines
- Current position highlighted with border
- Visited nodes dimmed
- Hidden nodes shown as '?'
- Clickable: only nodes connected to current position that haven't been visited
- HUD overlay: HP, Gold, Gem count, Current Tier
- On node click: transition to appropriate screen:
  - duel/elite/boss → LoadoutScreen (then CombatScreen)
  - merchant → MerchantScreen
  - shrine → ShrineScreen
  - rest → RestScreen
  - mystery → EventScreen

#### 6.4 `meta/LoadoutScreen.js`
- Shows full node network with current gem placements
- Shows gem inventory (unslotted gems) in a panel
- Click gem in inventory → click node to place (or click occupied node to swap)
- Each gem shows: element color, school icon, passive stat, spell name (if any)
- "Ready" button → transition to CombatScreen with current RunState + enemy data
- Shown before every combat encounter

#### 6.5 `meta/MerchantScreen.js`
- Generates 4–5 random gems via GemDatabase.generateRandomGem()
- Displays each with stats, element, school, passive, spell
- Shows price and player gold
- Buy button per gem (disabled if can't afford)
- "Leave" button → back to MapScreen

#### 6.6 `meta/ShrineScreen.js`
- Generates 3 random gems
- Display with full stats
- Pick one (free), added to inventory
- Back to MapScreen

#### 6.7 `meta/RestScreen.js`
- Two choices:
  - "Heal 30% HP" — immediately restore, show new HP
  - "Upgrade Spell" — show spell gems that have not been upgraded yet. Pick one. Upgraded gem gets: spell cooldown −20%, spell travel speed +50 (for prototype, simple stat boost). Mark gem.upgraded = true. **Each gem can only be upgraded once.** If player has no un-upgraded spell gems, this option is **grayed out** with a "No spell gems to upgrade" message.
- Back to MapScreen after choice

#### 6.8 `meta/EventScreen.js`
- Random event from pool:
  1. **Wandering Merchant** — gain a random gem free
  2. **Healing Spring** — full heal
  3. **Cursed Ground** — take 5 HP damage, gain 20 gold
  4. **Abandoned Cache** — gain a random gem, 50% chance passive stat is negative (penalty gem)
  5. **Ambush** — surprise combat. Auto-slot any unslotted gems into empty nodes before combat begins (random placement). No loadout screen. Double gold reward.
  6. **Meditation** — heal 15% HP
- Show event text, choice buttons, outcome
- Back to MapScreen

---

### LAYER 7 — Polish & Integration

#### 7.1 Start Screen
- Title "Wizard Beams"
- School attunement: 3 buttons (Order purple, Chaos yellow, Pure red-orange)
- Element attunement: 4 buttons (Fire red, Water blue, Earth brown, Air white)
- Node network preview: slot Grey Bolt and Shield Gem
- "Begin Run" → generate map → MapScreen

#### 7.2 Game Over Screen
- **Victory:** run stats (fights won, HP remaining, gold earned, gems collected)
- **Defeat:** tier reached, fights won, "Try Again" button
- "New Run" button → Start Screen

#### 7.3 Post-Combat Screen
- Gold reward display (tier-scaled)
- Gem offering: display 3 gems, pick 1 or decline
- "Continue" → MapScreen (nodes auto-repaired between fights per GDD)

#### 7.4 Visual Polish (Prototype)
- Backgrounds: solid dark colors per screen type (dark blue combat, dark brown map, etc.)
- Wizard sprites: simple colored rectangles with staff line, staff tip dot colored by element
- Node network: geometric stick figure silhouette
- Screen transitions: simple instant switch (no animation needed for prototype)

#### 7.5 Debug Panel
- Toggle with backtick (`) key
- Live view/edit of BalanceConfig values
- CombatState dump (all values)
- RunState dump
- Buttons: Skip Combat (instant win), Add Gold (+50), Add Random Gem, Instant Win, Instant Lose, Heal Full
- Overlay on top of everything, semi-transparent background

---

## Key Implementation Notes

### State Machine Pattern
Use for: beam switching, shield, node states, combat flow, AI states.
```javascript
class StateMachine {
  constructor(states) { this.states = states; this.current = null; }
  transition(newState, data) {
    if (this.current) this.states[this.current].exit?.();
    this.current = newState;
    this.states[this.current].enter?.(data);
  }
  update(dt) { this.states[this.current].update?.(dt); }
}
```

### Effective Mana Helper
This calculation is used by multiple systems. Put it in a shared utility or on CombatState:
```javascript
function getEffectiveMana(nodeNetwork, attunement, channelingSystem, counterDebuff) {
  let mana = nodeNetwork.getEffectiveMana();  // Open + Channeled nodes, each +1
  mana += 1;  // element attunement bonus (always +1)
  mana -= channelingSystem.getContinuousManaCost();  // sum of ALL channeled spell costs (including Shield Gem)
  mana -= counterDebuff;  // 0, 3, or 6
  return mana;  // can be negative
}
```
*Note: Shield Gem's mana cost is included in `getContinuousManaCost()` — no separate shield deduction.*

### Coordinate System
- Game coordinates: 960×540 (base resolution)
- Canvas element size: 960×540
- CSS scales to 1920×1080 (or viewport size)
- All game logic uses 960×540 coordinates
- InputManager divides mouse coords by CSS scale factor
- Player node network: lower-left area (~x:44-150, y:358-475)
- Enemy node network: mirrored to lower-right area (~x:810-916, y:358-475)
- Beams: horizontal across middle of screen (~y:205)
- HUD: top and sides

### Rendering Order (Back to Front)
1. Background
2. Wizard sprites (player left, enemy right)
3. Beams (between wizards)
4. Collision orb
5. Node networks (player + enemy)
6. Projectiles in flight
7. HUD
8. Targeting overlays
9. Debug panel (if active)

### Audio
Out of scope for prototype. No sound effects or music.

---

## Vercel Deployment

```
wizard-beams/
├── index.html              # Entry point (root level)
├── src/                    # All JS modules
│   └── (structure as above)
├── package.json
├── vercel.json
└── README.md
```

**index.html** is at root level. Script tag: `<script type="module" src="./src/main.js">`. All imports within src/ use relative paths (e.g., `import { EventBus } from './core/EventBus.js'`).

**vercel.json:**
```json
{
  "buildCommand": null,
  "outputDirectory": "."
}
```

**package.json:**
```json
{
  "name": "wizard-beams",
  "version": "0.1.0",
  "private": true
}
```

No build step. Vercel serves static files directly. ES6 modules work natively in modern browsers.

---

## File Dependency Graph

```
LAYER 0 (no dependencies):
  BalanceConfig → EventBus → Renderer → UIComponents → InputManager → GameLoop → SceneManager → main.js

LAYER 1 (depends on Layer 0):
  SpellDatabase → GemDatabase → EnemyDatabase → CombatState → NodeNetwork → NodeRenderer

LAYER 2 (depends on Layer 1):
  BeamStruggle → BeamSwitcher → ElementSystem → StabilitySystem

LAYER 3 (depends on Layer 2):
  ShieldSystem → ChannelingSystem

LAYER 4 (depends on Layer 3):
  Projectile → SpellCaster

LAYER 5 (depends on Layer 4):
  CombatHUD → CombatAI → CombatScreen

LAYER 6 (depends on Layer 5):
  RunState → MapGenerator → MapScreen → LoadoutScreen → MerchantScreen → ShrineScreen → RestScreen → EventScreen

LAYER 7 (depends on Layer 6):
  StartScreen → GameOverScreen → PostCombatScreen → Visual Polish → Debug Panel
```
