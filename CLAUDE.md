# Wizard Beams — Game Design Document v3 — FINAL

## Core Concept

A real-time tactical wizard duel. Two wizards face off in a beam struggle, pushing energy back and forth. Players manage an internal chakra-style node network to generate mana, unlock beam types, and counter enemy attacks. First to push the beam to the opponent or reduce their HP to zero wins.

Between fights, players navigate a branching node map (inspired by FTL), choosing encounters, gaining gems, and preparing for an increasingly dangerous gauntlet of rival wizards.

---

## Beam Struggle System

The central mechanic is a continuous tug-of-war between two energy beams.

### Collision Point
A value from 0–100 (starting at 50, center). Moves each frame based on mana differential:

```
push_force = (player_effective_mana − enemy_effective_mana) × push_rate × element_multiplier × delta_time
```

- Both beams are **always firing**, even at 0 or negative effective mana
- Negative effective mana counts as enemy advantage (adds to their push force)
- Beam thickness scales with effective mana but has a minimum visual size
- Collision point does **not** accelerate near the edges — constant push rate

### Win Conditions
- **Beam Overwhelm:** Push collision point to 0 (enemy wins) or 100 (player wins) — **instant kill**
- **HP Depletion:** Reduce opponent's HP to 0

### Effective Mana Calculation
```
effective_mana = mana_from_open_nodes (each +1)
              + mana_from_channeled_nodes (each +1)
              + element_attunement_bonus (+1)
              − channeled_spell_mana_costs (continuous while Channeled — includes Shield Gem if channeled)
              − counter_debuff (if being school-countered)
```

Effective mana can go **negative**. Minimum beam visual thickness still applies.

*Note: The Shield Gem's mana cost is part of `channeled_spell_mana_costs` — there is no separate shield cost deduction.*

### Balance Variables
```
collision_start: float = 50.0           # Starting collision point
push_rate: float = 2.0                  # Base push rate per mana differential (TBD — needs playtesting)
beam_min_thickness: float = 4.0         # Pixels at 0 mana (base resolution)
beam_max_thickness: float = 22.0        # Pixels at max mana (base resolution)
```

---

## Beam Types — School System (Rock-Paper-Scissors)

Three beam schools plus a neutral option:

- **Order** (purple) — beats Chaos
- **Chaos** (yellow) — beats Pure
- **Pure** (red/orange) — beats Order
- **Neutral/Suppress** (grey) — no school modifier, always available

### School Counter Mechanic
When one beam school beats another, the loser receives a mana debuff. This is a **continuous check** — evaluated every frame based on both wizards' current active beam schools. The debuff applies instantly when the counter relationship exists and removes instantly when it doesn't (e.g., when either wizard switches beams).

- **Base debuff:** −3 effective mana
- **Enhanced debuff:** −6 if the counter-er has all mana-contributing nodes active (all 10 nodes Open or Channeled)

Beam switch charge/lock timers handle simultaneous switching: whichever wizard's beam activates first establishes the counter state. When the second beam activates, the counter relationship updates.

```
school_counter_debuff: float = 3.0         # Effective mana penalty when school-countered
school_counter_debuff_max: float = 6.0     # Enhanced penalty when counter-er has all nodes active
```

### Beam Switching

Switching beams is a **commitment** with three distinct flows:

#### Switching to an Attack Beam (Order/Chaos/Pure)
1. Player clicks new beam type
2. **2-second charge** begins — old beam continues firing during charge
3. New beam activates — counter effects apply instantly
4. **Locked into new beam for 5 seconds** — cannot switch

#### Switching to Neutral/Suppress (Voluntary)
1. Player clicks Neutral
2. **Instant switch** — no charge time
3. **10% stability damage** immediately
4. **Locked on Neutral for 2 seconds**
5. Stability continues draining at normal rate while on Neutral

#### Forced to Neutral (Misfire/Node Loss)
Triggered when:
- Player channels a gem whose school locks out their current beam type
- Current beam type node is damaged or goes Dormant

Effect:
1. **Instant switch** to Neutral
2. **40% stability damage**
3. **Locked on Neutral for 2 seconds**

#### Switching Rules
- Cannot queue a beam switch while locked (must wait until lock expires, then click)
- Cannot switch to a beam type whose node is not Open
- Cannot switch to a beam type locked out by Channeled gem schools
- Switching to Neutral is always available regardless of locks

```
beam_switch_charge_time: float = 2.0       # Seconds to charge a new attack beam
beam_switch_lock_time: float = 5.0         # Seconds locked into attack beam after switching
neutral_switch_lock_time: float = 2.0      # Seconds locked on Neutral (voluntary or forced)
neutral_voluntary_stability: float = 10.0  # % stability damage for voluntary Neutral switch
neutral_forced_stability: float = 40.0     # % stability damage for forced Neutral (misfire/node loss)
```

---

## Element System

Four elements exist: **Fire**, **Water**, **Earth**, **Air**. Elements add a second layer of RPS on top of the school system.

### Element RPS
**Fire > Earth > Air > Water > Fire**

### Element Attunement
At the start of each run, the player chooses an element attunement in addition to school attunement:
- Grants **+1 effective mana** (always active, not tied to any node)
- Grants **+1 element count** of that element for dominance calculation
- Ties in element dominance default to attuned element
- Represented visually by the staff gem color on the wizard sprite

### Dominant Element Calculation
Each wizard's dominant element is determined by counting element types across **Open nodes only** (not Channeled, Dormant, or Damaged) plus the attunement bonus:

```
element_counts = { fire: 0, water: 0, earth: 0, air: 0 }
for each Open gem node:
    element_counts[gem.element] += 1
element_counts[attunement_element] += 1  # staff gem bonus
dominant_element = highest count (ties go to attuned element)
```

- Channeled gems do **NOT** contribute to element dominance (energy goes to spell, not beam)
- Dominant element **shifts with a 2-second delay** when nodes change state

### Beam Element Interaction
Your dominant element vs enemy's dominant element during beam struggle:
- **Winner:** Push force multiplied by `element_push_multiplier`
- **Loser:** No extra penalty (just doesn't get the bonus)
- **Neutral/tied:** No modifier

### Spell Element Interaction
Checked **when any spell hits** (shield, node, or other effect). Compares the **spell's element** vs the **defender's dominant element**:

| Scenario | Stability Damage to Defender |
|----------|------------------------------|
| Shield absorbs projectile + defender element beats spell element | **10%** (shield broke, no advantage bonus) |
| Shield absorbs projectile + neutral matchup | **10%** |
| Shield absorbs projectile + spell element beats defender | **40%** |
| Shield up vs non-projectile + defender element beats spell element | **0%** (clean mitigation) |
| Shield up vs non-projectile + neutral matchup | **10%** |
| Shield up vs non-projectile + spell element beats defender | **40%** |
| Shield down + defender element beats spell element | **10%** |
| Shield down + neutral matchup | **10%** |
| Shield down + spell element beats defender | **40%** |

This applies to **all spells** — both projectiles and non-projectiles. Spells with no element (Grey Bolt) always count as a neutral matchup. The shield gem inherits the user's dominant element for determining its own elemental identity visually but doesn't affect the spell element check (the check uses the spell's element, not the shield's).

**Stability from element checks stacks with spell-specific stability effects** (e.g., Air Choke vs shielded Earth-dominant defender = 50% from Air Choke mitigation + 40% from element counter = 90% total). This is intentional.

```
element_push_multiplier: float = 1.2              # Push force bonus for beam element winner
element_spell_stability_base: float = 10.0         # % stability to defender (neutral matchup or defender advantage w/o shield)
element_spell_stability_counter: float = 40.0      # % stability to defender (spell element wins)
element_shift_delay: float = 2.0                   # Seconds before dominant element updates after node state change
```

---

## Stability System

Staying on Neutral (Suppress) drains stability. Using an attack beam regenerates it.

- **Drain rate:** 25% per second while on Neutral (4 seconds to empty)
- **Regen rate:** 25% per second while on attack beam (4 seconds to full)
- **Punishment:** When stability hits 0%, a random undamaged functional node is Damaged. Stability resets to 100%.

Stability punishment damages a random node — this is disruptive but not devastating. It creates cascading pressure if the player stays on Neutral too long.

### All Stability Damage Sources

| Source | Amount | Condition |
|--------|--------|-----------|
| Neutral beam drain | 25%/s | While on Neutral |
| Voluntary Neutral switch | 10% | Instant on switch |
| Forced Neutral (misfire/node loss) | 40% | Instant on trigger |
| Spell element check (attacker advantage) | 40% | Spell element beats defender element (any shield state) |
| Spell element check (neutral matchup) | 10% | No element advantage (any shield state) |
| Spell element check (defender advantage) | 10% | Defender element beats spell, shield down or just broke |
| Non-projectile vs shield (defender advantage) | 0% | Defender element beats spell, shield still up (non-projectile only) |
| Non-projectile vs shield (Air Choke) | 50% over 3s | Shield mitigates to stability |
| Non-projectile vs shield (Water Beam) | 40% over 3s | Shield mitigates to stability |

Note: Spell element check stability damage **stacks with** spell-specific stability effects.

```
stability_drain_rate: float = 25.0      # % per second while on Neutral
stability_regen_rate: float = 25.0      # % per second while on attack beam
stability_max: float = 100.0
```

---

## Shield System

The shield is delivered via the **Shield Gem** — a spell gem that must be Channeled like any other spell. The shield blocks incoming projectile spells when active.

### Shield Gem Properties
- **School:** Neutral (no beam lockout when Channeled)
- **Element:** None — inherits the user's current dominant element for visual display
- **Mana cost:** Continuous while Channeled (like all spell gems)
- **Channel slot:** Takes one of the max Channeled spell slots
- **Starting gem:** Every run begins with a Shield Gem (alongside Grey Bolt)
- **Freely rearrangeable** between fights, can be sold/discarded

### Activation
- Shield Gem must be **Channeled** for the shield to be available
- While Channeled, click shield button in HUD (or hotkey) to raise/lower the shield
- Shield starts each fight **un-channeled and off**

### Behavior
- Shield absorbs **one** incoming projectile, then **immediately enters recharging state** (shield is now down)
- The element stability check runs **after** the shield breaks — meaning the check resolves against **shield down** state
- This means a blocked projectile always deals stability damage (10% neutral, 40% attacker advantage) unless the defender has element advantage (10% — not 0%, because shield is down at time of check)
- Non-projectile spells (Air Choke, Water Beam) are not blocked but mitigated to stability damage when shield is up
- Player can toggle shield off at any time
- Toggling back on has no cooldown (immediate)

### Recharge
- After absorbing a hit, shield enters a recharge cooldown
- Shield auto-restores when recharge completes (no player action needed)
- Player can un-channel the Shield Gem during recharge to stop paying the channel mana cost, but this deactivates the shield entirely

### Visual
Shield state and element are visible on the wizard sprite (e.g., fire shield, water shield).

```
shield_mana_cost: float = 1.0        # Effective mana cost (continuous while Channeled)
shield_recharge_time: float = 3.0    # Seconds to recharge after absorbing a hit
```

---

## Gem System

Gems are the unified upgrade system. Every gem has:

1. **+1 effective mana** when its node is Open or Channeled
2. **A passive stat bonus** (e.g., faster awareness, faster shield recharge) — active when Open or Channeled
3. **An element** (Fire, Water, Earth, or Air — or none for Grey Bolt and Shield Gem)
4. **A school** (Pure, Order, Chaos, or Neutral)

Some gems carry an **active spell** that becomes available when the gem is Channeled.

### Channeled Spell Mana Cost
When a spell gem is Channeled, its `mana_cost` is **deducted continuously** from effective mana for as long as it remains Channeled. The node still contributes +1 mana, but the spell cost offsets it:

| Spell | Node Mana | Spell Cost | Net Mana |
|-------|-----------|------------|----------|
| Grey Bolt (cost 1) | +1 | −1 | **0** |
| Shield (cost 1) | +1 | −1 | **0** |
| Fireball (cost 2) | +1 | −2 | **−1** |
| Earth Barrage (cost 2) | +1 | −2 | **−1** |
| Air Choke (cost 2) | +1 | −2 | **−1** |
| Water Beam (cost 2) | +1 | −2 | **−1** |

This creates a significant beam pressure tradeoff for Channeling expensive spells.

### Gem Schools & Beam Lockout

Each gem belongs to a beam school. When a spell gem is **Channeled**, it locks out the beam type that beats its school:

| Gem School | Channeling Locks Out |
|------------|---------------------|
| Pure | Chaos beam (Chaos beats Pure) |
| Order | Pure beam (Pure beats Order) |
| Chaos | Order beam (Order beats Chaos) |
| Neutral | No lockout |

- Lockout is binary: any single Channeled gem of a school triggers the lockout
- Multiple schools Channeled = multiple beams locked
- Lockout only applies while Channeled — un-channeling removes it instantly
- **Danger:** Channeling gems from all three schools locks out all attack beams, leaving only Neutral
- **Misfire:** If you Channel a gem that locks out your current beam type, you are forced to Neutral (40% stability + 2s lock)

### Gem Slots
- Gems slot into any of the **7 gem slot nodes:** Crown, Third Eye, Throat, Left Shoulder, Right Shoulder, Left Root, Right Root
- Gems can be **freely rearranged between fights** at no cost
- No maximum inventory size — player can carry unlimited gems
- **Empty gem slot nodes can still be activated** by awareness for +1 mana and element dominance counting. Gems add passive bonuses and spells on top of base node functionality. This means early-game players still have access to all 10 mana nodes (7 gem slots + 3 beam type) even with only 2 gems.

### Passive Stats
Each gem has one passive stat bonus from this pool. Passives **stack additively** with **minimum floor values**:

```
awareness_speed_bonus: float = -50.0   # ms reduction per node travel (floor: 100ms)
activation_speed_bonus: float = -0.25  # seconds off node activation time (floor: 0.5s)
shield_recharge_bonus: float = -0.5    # seconds off shield recharge (floor: 1.0s)
beam_switch_bonus: float = -0.5        # seconds off beam switch charge time (floor: 0.5s)
spell_cooldown_bonus: float = -10.0    # percentage off spell cooldowns (floor: 50% reduction)
node_repair_bonus: float = -0.5        # seconds off node repair time (floor: 1.0s)
```

### Gem Sources
- **Merchant** (buy with gold, flat price)
- **Combat rewards** (pick 1 of 3 gems after each wizard duel)
- **Events** (mystery nodes, spell shrines)

### Gem Generation (Prototype — Placeholder)
Random gem generation uses equal probability for all elements and schools. All three schools (Pure, Order, Chaos) can appear — Order and Chaos school gems have passives and beam lockout but no active spells until those spell sets are designed. Higher tiers increase the chance of a gem carrying an active spell. **This system is a placeholder and will need proper design for the final game.**

### Starting Gems
Every run begins with two gems:
1. **Grey Bolt** (Neutral school, no element) — can be sold/discarded later
2. **Shield Gem** (Neutral school, no element, inherits dominant element) — can be sold/discarded later

Player chooses where to slot both before the first fight.

```
gem_price: int = 15    # Flat gold cost at merchant (balance variable)
```

---

## Node States

Nodes progress through states during combat:

| State | Description | Mana | Passive | Spell | Lockout | Element Counts |
|-------|------------|------|---------|-------|---------|----------------|
| **Dormant** | Starting state, dim. Gem slotted but inactive. | No | No | No | No | No |
| **Open** | Activated. Gem contributing. | +1 | Yes | No | No | Yes |
| **Channeled** | Spell equipped and castable. (Spell gems only.) | +1 | Yes | Yes | Yes | **No** |
| **Damaged** | Broken. Must be repaired with awareness. | No | No | No | No | No |

### State Transitions
```
Dormant → Open          (awareness at node, node_activation_time seconds)
Open → Channeled        (click in HUD, channel_time seconds) [spell gems only]
Channeled → Open        (click in HUD, instant)
Any state → Damaged     (hit by projectile spell or stability punishment)
Any state → Dormant     (hit by Air Choke or Water Beam — non-projectile disruption)
Damaged → Dormant       (awareness at node, node_repair_time seconds)
```

**Key distinction:**
- **Projectile spells** (Grey Bolt, Fireball, Earth Barrage) set hit nodes to **Damaged** (requires 3s repair + 2s activation = 5s total recovery)
- **Non-projectile spells** (Air Choke, Water Beam) set hit nodes to **Dormant** (requires 2s activation only)
- **Dormant nodes CAN be targeted and Damaged** by projectile spells — this extends recovery from 2s to 5s
- **Already-Damaged nodes** can be hit by projectiles: HP damage still applies, node stays Damaged (no extra node effect)

### Channeling Rules
- Node must be **Open** before it can be Channeled
- Channel/un-channel is done from the HUD (no awareness required)
- Max simultaneous Channeled spells is a balance variable
- Channeling a spell while at max limit requires un-channeling another first
- Channeling costs the spell's `mana_cost` continuously while Channeled

```
max_channeled_spells: int = 2             # Max simultaneous Channeled gems (balance variable)
channel_time: float = 1.5                 # Seconds to transition Open → Channeled
unchannel_time: float = 0.0              # Instant un-channel
node_activation_time: float = 2.0        # Seconds with awareness present to Open a node
node_repair_time: float = 3.0            # Seconds with awareness present to repair Damaged → Dormant
```

### Beam Type Nodes
The three beam type nodes (Right Hand/Order, Left Hand/Chaos, Belly/Pure) are **not** gem slots but do contribute **+1 mana** when Open. They follow the same Dormant → Open state progression. They **can be targeted and Damaged** by projectile spells — if your current beam type node is Damaged, you are forced to Neutral (40% stability + 2s lock).

---

## Spell System

Spells are active abilities carried by certain gems. They are cast by clicking the spell icon in the HUD. The gem must be **Channeled** to cast its spell. Channeling costs the spell's `mana_cost` continuously. Each spell also has a cooldown between casts. Spell projectiles have **visible travel time** (like FTL weapons).

### Spell Categories

**Projectiles** — blocked entirely by shield, visible travel time, set hit nodes to **Damaged**:
- Grey Bolt, Fireball, Earth Barrage

**Non-projectiles** — mitigated to stability damage by shield, set hit nodes to **Dormant**:
- Air Choke, Water Beam

### Spell Schools (Current)

All elemental spells designed so far are **Pure school**. Order and Chaos school spells are planned for future design.

| Spell | Element | School | Projectile? | Node Effect |
|-------|---------|--------|------------|-------------|
| Grey Bolt | None | Neutral | Yes | Damaged |
| Shield | None (inherits dominant) | Neutral | N/A (defensive) | N/A |
| Fireball | Fire | Pure | Yes | Damaged |
| Earth Barrage | Earth | Pure | Yes | Damaged |
| Air Choke | Air | Pure | No | Dormant |
| Water Beam | Water | Pure | No | Dormant |

### Spell Element Check (On Hit)

Every spell hit triggers an element check: **spell's element** vs **defender's dominant element**. For projectiles blocked by shield, the check runs **after** the shield breaks (shield is down at time of check).

| Scenario | Stability Damage to Defender |
|----------|------------------------------|
| Shield absorbs projectile + defender element beats spell element | **10%** |
| Shield absorbs projectile + neutral matchup | **10%** |
| Shield absorbs projectile + spell element beats defender | **40%** |
| Shield up vs non-projectile + defender element beats spell element | **0%** |
| Shield up vs non-projectile + neutral matchup | **10%** |
| Shield up vs non-projectile + spell element beats defender | **40%** |
| Shield down + defender element beats spell element | **10%** |
| Shield down + neutral matchup | **10%** |
| Shield down + spell element beats defender | **40%** |

Grey Bolt and Shield have no element — always neutral matchup.

This stability damage **stacks with** any spell-specific stability effects (e.g., Air Choke vs shield = 50% spell effect + element check result).

### Targetability Rules
- **All node types can be targeted** by projectile spells — gem slot nodes, beam type nodes, and pathway nodes
- Dormant nodes can be targeted (goes to Damaged, extending recovery)
- Already-Damaged nodes can be targeted (HP damage still applies, node stays Damaged)

### Spell List

#### Grey Bolt (Starting Spell — Neutral School, No Element)
Single-target projectile. A basic magical bolt that damages an enemy node.

- **Targeting:** Click to enter targeting mode, click an enemy node to fire
- **Impact:** Target node → Damaged + HP damage
- **Shield interaction:** Projectile — blocked entirely by shield
- **School:** Neutral (no beam lockout when Channeled)
- **Channel cost:** −1 mana (continuous while Channeled, nets 0 with node's +1)

```
grey_bolt_mana_cost: float = 1.0         # Continuous mana cost while Channeled
grey_bolt_hp_damage: int = 3             # HP damage on hit
grey_bolt_cooldown: float = 5.0          # Seconds between casts
grey_bolt_travel_speed: float = 300.0    # Pixels per second
```

#### Shield Gem (Starting Defensive Spell — Neutral School, No Fixed Element)
Defensive spell. Provides a toggleable projectile shield when Channeled.

- **Targeting:** No targeting — toggle shield on/off via HUD button
- **Impact:** Absorbs one incoming projectile, then recharges
- **School:** Neutral (no beam lockout when Channeled)
- **Element:** Inherits user's current dominant element (visual only)
- **Channel cost:** −1 mana (continuous while Channeled, nets 0 with node's +1)

```
shield_mana_cost: float = 1.0            # Continuous mana cost while Channeled
shield_recharge_time: float = 3.0        # Seconds to recharge after absorbing a hit
```

#### Fireball (Fire Element — Pure School)
AOE projectile. Place a targeting circle over enemy nodes — all nodes within the radius are hit.

- **Targeting:** Click to enter targeting mode, position circle over enemy node network, click to fire
- **Impact:** All nodes within radius → Damaged + HP damage per node hit
- **Shield interaction:** Projectile — blocked entirely by shield (whole fireball negated)
- **School:** Pure (Channeling locks out Chaos beam)
- **Channel cost:** −2 mana (continuous while Channeled, nets −1 with node's +1)

```
fireball_radius: float = 40.0           # Targeting circle radius in pixels (balance variable — needs playtesting)
fireball_mana_cost: float = 2.0         # Continuous mana cost while Channeled
fireball_hp_damage_per_node: int = 3    # HP damage per node hit
fireball_cooldown: float = 15.0         # Seconds between casts
fireball_travel_speed: float = 200.0    # Pixels per second
```

#### Earth Barrage (Earth Element — Pure School)
Multi-hit probabilistic projectile. Spawns multiple rocks aimed at a single target node. Each rock rolls independently to hit. Natural shield-breaker since shield only absorbs one rock. Visual: a cluster of debris flying at the target with slight stagger for readability.

- **Targeting:** Click to enter targeting mode, click an enemy node
- **Resolution order:** Rocks resolve sequentially (slight visual stagger). Each rock rolls twice:
  1. **Shield roll:** If shield is up, roll `earth_hit_chance` — if successful, shield absorbs this rock (shield breaks, enters recharging). Only the first rock can be shield-blocked.
  2. **Node roll:** Roll `earth_hit_chance` — if successful, target node → Damaged + HP damage
- **Element check:** Fires **once per rock that hits a node** (not per rock that hits shield). Each successful node hit triggers a separate element stability check.
- **Shield interaction:** Shield blocks the **first rock that passes its hit roll**. Remaining rocks skip shield roll entirely (shield is already down).
- **School:** Pure (Channeling locks out Chaos beam)
- **Channel cost:** −2 mana (continuous while Channeled, nets −1 with node's +1)

```
earth_rock_count: int = 4               # Number of rocks spawned (balance variable)
earth_hit_chance: float = 0.5           # Probability each rock hits (50%) — used for both shield roll and node roll
earth_mana_cost: float = 2.0            # Continuous mana cost while Channeled
earth_hp_damage_per_rock: int = 3       # HP damage per rock that lands on node
earth_cooldown: float = 12.0            # Seconds between casts
earth_travel_speed: float = 250.0       # Pixels per second
earth_stagger_delay: float = 0.1        # Seconds between each rock's visual arrival (for readability)
```

#### Air Choke (Air Element — Pure School)
TBD
#### Water Beam (Water Element — Pure School)
TBD

## Node Network System

### Layout: Chakra Meditation Pose

A seated meditation figure with 13 total nodes. The background art is a silhouette with cosmic/nebula theming.

**7 Gem Slot Nodes (large, slottable):**

| Node | Position (x, y) | Mana |
|------|-----------------|------|
| Crown | (98, 358) | +1 when Open/Channeled |
| Third Eye | (98, 374) | +1 when Open/Channeled |
| Throat | (98, 396) | +1 when Open/Channeled |
| Left Shoulder | (121, 412) | +1 when Open/Channeled |
| Right Shoulder | (72, 412) | +1 when Open/Channeled |
| Left Root | (123, 475) | +1 when Open/Channeled |
| Right Root | (70, 475) | +1 when Open/Channeled |

**3 Beam Type Nodes (large, fixed function):**

| Node | Position (x, y) | Beam Type | Mana |
|------|-----------------|-----------|------|
| Belly | (98, 446) | Pure | +1 when Open |
| Left Hand | (150, 472) | Chaos | +1 when Open |
| Right Hand | (44, 472) | Order | +1 when Open |

**3 Pathway Nodes (small, transit only):**

| Node | Position (x, y) |
|------|-----------------|
| Sternum | (98, 412) |
| Left Elbow | (130, 447) |
| Right Elbow | (63, 447) |

*Pathway nodes contribute no mana and have no gem slots, but can be Damaged to block travel paths.*

*Note: Left/Right are from the viewer's perspective (looking at the figure).*

**Maximum possible mana: 11** (7 gem slots + 3 beam type nodes + 1 element attunement)

### Node Connections

Full adjacency:
- Crown ↔ Third Eye
- Third Eye ↔ Throat
- Throat ↔ Sternum
- Sternum ↔ Belly
- Sternum ↔ Left Shoulder
- Sternum ↔ Right Shoulder
- Left Shoulder ↔ Left Elbow
- Left Elbow ↔ Left Hand
- Right Shoulder ↔ Right Elbow
- Right Elbow ↔ Right Hand
- Belly ↔ Left Root
- Belly ↔ Right Root
- Left Root ↔ Right Root

### Attunement System

At the start of each run, the player makes two choices:

1. **School Attunement** (Order/Chaos/Pure) — determines starting beam type, starting node, and awareness start position
2. **Element Attunement** (Fire/Water/Earth/Air) — grants +1 effective mana, +1 element count, breaks ties in element dominance, visible on wizard sprite staff gem

- **Order attunement** → Awareness starts at Right Hand, Order beam active, Right Hand starts Open
- **Chaos attunement** → Awareness starts at Left Hand, Chaos beam active, Left Hand starts Open
- **Pure attunement** → Awareness starts at Belly, Pure beam active, Belly starts Open

Other beam type nodes must be reached and activated to unlock those beam types.

### Awareness System

A single point of focus that travels the node network:

- Starts at the attuned beam type node each fight
- Must follow connected paths (BFS pathfinding, cannot teleport)
- Cannot click other nodes while awareness is traveling
- Activation progress pauses if awareness leaves, resumes on return
- **Awareness is never blocked by Damaged pathway nodes.** When awareness reaches a Damaged node on its travel path, it automatically repairs the node (spending `node_repair_time`) before continuing travel. This prevents softlock scenarios where a Damaged Sternum cuts the network in half.

```
awareness_travel_time_player: float = 300.0   # ms between adjacent nodes (floor: 100ms after passives)
```

---

## HP System

FTL-style hit point pips.

- **Max HP:** 30 (starting value)
- **Damage sources:** Grey Bolt (3), Fireball (3 per node), Earth Barrage (3 per rock hit)
- **Instant kill:** Beam overwhelm (collision point reaches 0 or 100)
- Displayed as pip bars in the HUD
- **Persistent between fights** — HP does not reset between encounters

```
starting_max_hp: int = 30
grey_bolt_damage: int = 3
fireball_damage_per_node: int = 3
earth_rock_damage: int = 3
```

---

## Beam Visuals (Prototype)

For the prototype phase, beams are rendered using draw calls. This is temporary — final art will use custom tiled sprites per school+element combination.

### School Beam Outlines
Each school has a distinct beam edge pattern for readability:

- **Order:** Wavy sine-wave edges
- **Chaos:** Jagged zigzag edges
- **Pure:** Flat straight edges
- **Neutral:** Flat straight edges, dimmer

### School Colors
```
school_colors = {
    "order": purple (0.5, 0.0, 0.8),
    "chaos": yellow (1.0, 0.9, 0.0),
    "pure": red-orange (1.0, 0.3, 0.0),
    "neutral": grey (0.5, 0.5, 0.5)
}
```

---

## Meta Game — The Astral Gauntlet

Between wizard duels, the player navigates a branching map of encounters.

### Run Structure

**3 Tiers**, each containing **4–6 nodes** in branching paths. Final node of Tier 3 is the **Archmage** (final boss). Each tier has 2–3 branching paths. A full run is approximately 8–12 encounters.

### Run Start

1. **Choose School Attunement** — Order, Chaos, or Pure
2. **Choose Element Attunement** — Fire, Water, Earth, or Air
3. **Receive Grey Bolt Gem + Shield Gem** — slot both into the node network
4. **Starting HP:** 30/30
5. **Starting Gold:** 0

### Node Types

**Wizard Duel (Skull icon)** — Standard combat. **Reward:** Gold (scaling by tier) + gem offering (pick 1 of 3)

**Elite Wizard (Horned Skull icon)** — Stat boosts + unique mechanic. One per tier, optional branch. **Reward:** Guaranteed spell gem

**Rest Site (Campfire icon)** — Heal 30% max HP OR upgrade a spell gem (not both)

**Merchant (Bag icon)** — Sells 4–5 randomly selected gems at flat price

**Spell Shrine (Crystal icon)** — Pick 1 of 3 randomly offered gems, free

**Mystery Node (? icon)** — Random event from pool of 5–8 hand-crafted events

**Archmage (Crown icon)** — Final boss, end of Tier 3

```
tier_count: int = 3
nodes_per_tier_min: int = 4
nodes_per_tier_max: int = 6
elites_per_tier: int = 1
rest_site_heal_percent: float = 0.3
gem_price: int = 15
gold_reward_tier_1: int = 10
gold_reward_tier_2: int = 15
gold_reward_tier_3: int = 20
post_combat_gem_offering_count: int = 3
```

### Resource Persistence Between Fights

| Resource | Persists? | Notes |
|----------|-----------|-------|
| HP | Yes | Healed at Rest Sites and events only |
| Gold | Yes | Spent at Merchants |
| Gems | Yes | Freely rearrangeable between fights |
| School Attunement | Yes | Fixed for entire run |
| Element Attunement | Yes | Fixed for entire run |
| Node states | **No** | All reset to Dormant (except attuned beam node → Open) |
| Node damage | **No** | Repaired for free after each fight |
| Awareness | **No** | Resets to attuned beam type node |
| Shield | **No** | Un-channeled at fight start |
| Channeled spells | **No** | All un-channeled at fight start |
| Spell cooldowns | **No** | Reset each fight |

---

## Enemy AI

The enemy wizard has its own node network (mirrored) and follows the **same rules** as the player.

### Enemy Attunement
Each enemy has a **randomly generated** school attunement and element attunement. Unlocked beam types: always start with their attuned beam type, additional types randomly selected from the remaining two based on tier.

### Grey Bolt
**All enemies have Grey Bolt** regardless of tier (separate from tier gem count).

### AI Decision Rules (Prototype)

**Awareness AI:**
- Priority: repair Damaged nodes → activate Dormant spell gem nodes → activate Dormant mana nodes
- Decision delay after arriving at node (tier-dependent)

**Beam AI:**
- Attempts to counter player's current beam school
- Avoids switching to Neutral when stability < 50%
- Reaction time delay (tier-dependent)
- Respects beam switch charge/lock timers

**Shield AI:**
- Channels Shield Gem when it has enough mana to spare
- Raises shield when threats are incoming

**Spell AI:**
- Channels Grey Bolt when stability > 50% and effective mana ≥ 3
- Grey Bolt targeting: random selection from (spell gem nodes + beam type nodes + other Open nodes), weighted toward high-value targets
- Fire interval: fixed timer while Channeled
- Un-channels when beam pressure is needed (mana < 2)
- Respects beam lockout rules

```
enemy_grey_bolt_interval: float = 8.0    # Seconds between Grey Bolt casts when Channeled
enemy_ai_decision_interval: float = 1.0  # Seconds between AI re-evaluations
```

### Enemy Scaling

TBD
## Technical Specifications

### Platform (Prototype)
- **Stack:** Vanilla JavaScript + HTML5 Canvas, ES6 modules
- **Base Resolution:** 960×540
- **Display Resolution:** 1920×1080 (2× CSS scale)
- **Art Style:** Placeholder shapes (prototype), pixel art (final)
- **Deployment:** GitHub → Vercel (static site)
- **Future Port:** Godot 4.x (GDScript)

### Data Structures

**RunState:**
```
school_attunement: string
element_attunement: string
hp: int = 30
max_hp: int = 30
gold: int = 0
gems: array of GemData
gem_slots: dict (node_name → gem_id)
current_tier: int = 1
map_data: MapData
current_node_id: int
```

**GemData:**
```
id: string
element: string           # "fire", "water", "earth", "air", "" (none)
school: string            # "pure", "order", "chaos", "neutral"
passive_stat: string
passive_value: float
spell_id: string = ""     # empty if no spell
upgraded: bool = false
```

**SpellData:**
```
id: string
element: string
school: string
is_projectile: bool
node_effect: string       # "damaged" or "dormant"
mana_cost: float          # continuous cost while Channeled
cooldown: float
travel_speed: float       # pixels/sec, 0 for non-projectiles
```

**NodeState enum:**
```
DORMANT     # Inactive
OPEN        # Activated, +1 mana + passive + element counts
CHANNELED   # Spell equipped, +1 mana + passive, lockout, element does NOT count
DAMAGED     # Broken, needs repair
```

**CombatState:**
```
# Beam
current_beam_school: string
beam_switch_state: string       # "ready", "charging", "locked"
beam_switch_timer: float
beam_switch_target: string

# Element
dominant_element: string
element_shift_timer: float
pending_dominant_element: string

# Shield (if Shield Gem is Channeled)
shield_up: bool
shield_state: string            # "down", "up", "recharging"
shield_recharge_timer: float

# Stability
stability: float = 100.0

# Collision
collision_point: float = 50.0

# Channeling
channeled_gems: array of gem_ids
locked_beam_types: array of school strings
```

**EnemyData:**
```
school_attunement: string
element_attunement: string
hp: int
awareness_speed: float
beam_types_unlocked: int
reaction_time: float
has_shield: bool
gems: array of GemData
all_nodes_open: bool = false
is_elite: bool = false
```

### Beam Start Positions
- **Player staff tip offset from sprite center:** (+44, −38)
- **Player sprite position:** (86, 236)
- **Enemy sprite position:** (874, 236) with horizontal mirror
- **Beam Y offset:** viewport.y / 2.0 − 65

---

## Design Pillars

1. **Multitasking under pressure.** Manage beam school, element dominance, awareness position, shield channeling, spell channeling, and spell casting simultaneously.

2. **Meaningful tradeoffs.** Channeling spells costs continuous mana and locks beam types. Shield requires a channel slot. Healing costs a spell upgrade. Every action has a price.

3. **Readable counterplay.** The opponent's beam school, shield status, dominant element, and node network are visible. Players win through reads and adaptation.

4. **Escalating danger.** Persistent HP, tougher enemies, and the opportunity cost of healing vs. upgrading create mounting pressure.

5. **Accessible depth.** "Push the beam" and "click the glowing nodes" are understood in seconds. Deeper systems reveal themselves over many runs.

---

## Planned Features (Not Yet Designed)

- **Order school spells** — 4 element spells for Order gems
- **Chaos school spells** — 4 element spells for Chaos gems
- **Spell upgrades** — Enhanced versions of each spell (selected at Rest Sites)
- **Elite unique mechanics** — Specific gimmicks per elite encounter
- **Mystery event catalog** — 5–8 hand-crafted events
- **Final beam art** — Tiled sprite sets per school+element combo
- **Roguelite unlocks** — Permanent progression across runs (stretch goal)
- **Audio** — Sound effects and music (out of scope for prototype)

---

## Naming Reference

| Prototype (HTML5) | Final (Godot) |
|-----------|-----------|
| Spiral | Order |
| Zap | Chaos |
| Pulse | Pure |
| Suppress / Neutral | Neutral |
| Body Nodes (stick figure) | Chakra Network (meditation pose) |
| Center node | Attuned node (varies per fight) |
| Fixed spell nodes | Gem slots (unified system) |
| Mana Shards | Grey Bolt (Neutral school gem) |
| Active (node state) | Open |
| Active + spell equipped | Channeled |
