# 🧟 Z-Maze Shooting — 3D Maze Escape

> A first-person 3D maze-escape game with **AI-powered zombie NPCs**, built with
> **Three.js + Vite** following strict **Clean Architecture** principles.

---

## 📖 Table of Contents

1. [What is this game?](#-what-is-this-game)
2. [How to Play — Controls](#-how-to-play--controls)
3. [Game Rules & Win/Lose Conditions](#-game-rules--winlose-conditions)
4. [Quick Start (Getting It Running)](#-quick-start-getting-it-running)
5. [How the Game Works — Big Picture](#-how-the-game-works--big-picture)
6. [What is Three.js? (For Beginners)](#-what-is-threejs-for-beginners)
7. [What is Clean Architecture? (For Beginners)](#-what-is-clean-architecture-for-beginners)
8. [Project Architecture In Depth](#-project-architecture-in-depth)
9. [How the AI Zombie System Works](#-how-the-ai-zombie-system-works)
10. [Full File Reference](#-full-file-reference)
11. [Debug Mode](#-debug-mode)
12. [Adding New NPCs / Extending the Game](#-adding-new-npcs--extending-the-game)
13. [Architecture Rules (for Contributors)](#-architecture-rules-for-contributors)
14. [Game World & Lore](#-game-world--lore)
15. [Further Reading](#-further-reading)

---

## 🎮 What is this game?

**Z-Maze Shooting — 3D Maze Escape** is a browser-based, first-person 3D game. You wake up as a survivor trapped inside the cursed dungeons of **Z-Maze Shooting** — a medieval kingdom that fell into darkness after the death of its last king. Undead hordes roam the labyrinthine halls. Your only goal: **shoot your way through and reach the exit alive.**

### Core gameplay loop

```
You spawn at the maze entrance
       │
       ├─► Explore the first-person 3D maze (WASD + mouse look)
       │
       ├─► Zombies detect you and react in real time
       │       idle ──► chase ──► attack ──► flee
       │       (decisions driven by Google Gemini AI)
       │
       ├─► Shoot zombies (left-click or hold to fire)
       │
       ├─► Reload when your magazine is empty (R key)
       │
       ├─► Use your Panoramic Scan to reveal the map (V key)
       │
       └─► Find the EXIT cell to advance — or die trying
```

### Key features at a glance

| Feature | Details |
|---|---|
| 🧩 Procedural maze | Randomly generated every time using a Recursive Backtracker algorithm |
| 🧟 AI zombies | Each zombie's behavior (`idle` / `chase` / `attack` / `flee`) is decided by **Google Gemini 2.0 Flash Lite** at runtime |
| 🔫 Combat system | Raycaster-based shooting, bullet-flight projectiles, hit detection, HP management |
| 🎯 First-person camera | Pointer-lock mouse-look, collision-aware sliding movement |
| 📟 HUD | Live health bar, ammo counter, lives counter, scan charges, crosshair |
| 🔊 Spatial audio | Sound effects for gunshots, zombie groans, hits, and player actions |
| 🗺️ Panoramic scan | A limited consumable that temporarily reveals the top-down map |
| 🌍 Game world | Factions, lore, and NPC rules loaded from `.md` knowledge files |

---

## 🕹️ How to Play — Controls

> **First step:** Click anywhere on the game canvas to activate the mouse. This is called **Pointer Lock** — once active, your mouse controls your camera direction.

| Input | Action |
|---|---|
| `W` or `↑` | Move **forward** |
| `S` or `↓` | Move **backward** |
| `A` or `←` | Strafe **left** |
| `D` or `→` | Strafe **right** |
| **Mouse** (after click) | Look around (360° first-person camera) |
| **Left-click** (hold) | **Shoot** — hold to fire continuously at up to 5 shots/sec |
| `R` | **Reload** — takes 1.5 seconds, fills magazine to 30 rounds |
| `V` | **Panoramic Scan** — reveals a top-down map view (3 charges per life) |
| `Esc` | Release pointer lock (pause mouse capture) |

### Tips
- **Diagonal movement** is automatically normalised — you won't move faster diagonally.
- You **slide along walls** instead of getting stuck — keep moving even if you graze a corner.
- When **reloading**, movement continues but firing is locked.
- **Panoramic Scan mode** freezes movement and firing — use it strategically.
- Listen for **zombie groans** — they warn you when an enemy is within 15 units.

---

## 🏆 Game Rules & Win/Lose Conditions

### Lives & Health
- You start with **3 lives** and **100 HP**.
- Each zombie attack deals **15 damage**.
- When HP reaches 0, you **lose one life** and respawn at the maze entrance with full health and ammo.
- When all lives are gone → **Game Over**.

### Ammo
- Magazine holds **30 rounds**.
- Shooting costs 1 round per shot.
- Press `R` to reload (1.5 second animation).
- Ammo refills completely on each respawn and on level start.

### Winning
- Navigate the maze until you step on the **EXIT cell**.
- The exit triggers the next level (currently restarts the maze with a new random layout).

### Zombie Stats
- **Health:** 100 HP per zombie.
- **Damage:** 15 per attack.
- **Attack range:** 1.8 world units (~arm's length).
- **Attack cooldown:** 1.5 seconds between hits.
- **Speed:** 2 world units per second.
- A zombie with **HP below 30** may choose to `flee` instead of attacking.

---

## 🚀 Quick Start (Getting It Running)

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or later
- A Google Gemini API key (free at [aistudio.google.com](https://aistudio.google.com))

### Step 1 — Install dependencies

```bash
npm install
```

This installs **Three.js** (the 3D library) and **Vite** (the development server / bundler).

### Step 2 — Set up your API key

Create a file named `.env` in the project root (next to `package.json`):

```env
VITE_GOOGLE_API_KEY=your_google_gemini_api_key_here
VITE_DEBUG=false
```

> ⚠️ The `.env` file is listed in `.gitignore` — it will **never** be committed to Git. Never hardcode keys directly in JavaScript files.

### Step 3 — Start the development server

```bash
npm run dev
```

Open your browser at [http://localhost:5173](http://localhost:5173). The game loads immediately.

### Available scripts

| Command | What it does |
|---|---|
| `npm run dev` | Starts Vite dev server with Hot Module Replacement (HMR) |
| `npm run build` | Compiles and bundles for production → outputs to `dist/` |
| `npm run preview` | Serves the production build locally for testing |

---

## 🌍 How the Game Works — Big Picture

Here is the full journey from "pressing W" to "zombie chasing you on screen":

```
┌─────────────────────────────────────────────────────────────┐
│  YOU press W                                                 │
│       │                                                      │
│       ▼                                                      │
│  InputHandler (presentation layer)                           │
│  Tracks which keys are currently held down                   │
│       │                                                      │
│       ▼                                                      │
│  PlayerController (use-case layer) — runs every frame        │
│  Translates WASD into a movement vector                      │
│  Runs collision detection against the maze grid              │
│  Updates Player.position (pure math — no Three.js)           │
│  Emits  PlayerEvents.MOVED  via EventBus                     │
│       │                                                      │
│       ▼                                                      │
│  FirstPersonCamera (infrastructure/three)                    │
│  Listens for PlayerEvents.MOVED on EventBus                  │
│  Syncs the Three.js camera to the new position/yaw/pitch     │
│       │                                                      │
│       ▼                                                      │
│  RenderLoop calls THREE.WebGLRenderer.render() at 60 FPS     │
│  Draws the 3D scene from the camera's perspective            │
└─────────────────────────────────────────────────────────────┘
```

The key insight: **the game world is represented in pure JavaScript objects** (Player, Zombie, Maze). Three.js only **reads** those objects to draw them — it never drives the logic.

---

## 🖥️ What is Three.js? (For Beginners)

**Three.js** is a JavaScript library that lets you draw 3D graphics inside a web browser using **WebGL** — the browser's built-in hardware-accelerated graphics engine.

Without Three.js, WebGL requires thousands of lines of low-level GPU code. Three.js wraps that into simple concepts:

| Three.js Concept | Real-world analogy |
|---|---|
| **Scene** | The stage where everything is placed |
| **Camera** | The "eye" looking into the scene |
| **Renderer** | The projector that draws what the camera sees onto the screen |
| **Mesh** | A 3D object (geometry + material = shape + appearance) |
| **Light** | A light source (ambient, directional, point, etc.) |
| **Raycaster** | An invisible laser beam used to detect what the player is aiming at |

In this project, **all Three.js code lives exclusively in `src/infrastructure/three/`**. Nothing outside that folder knows Three.js exists.

---

## 🏛️ What is Clean Architecture? (For Beginners)

**Clean Architecture** (coined by Robert C. Martin, also known as "Uncle Bob") is a design philosophy that organises code into **concentric layers**, where:

- The **inner layers** contain the most important business logic.
- The **outer layers** handle technical details (databases, UIs, external APIs).
- **Dependencies only flow inward** — inner layers never import from outer layers.

Why does this matter? It means you can **swap out Three.js for a completely different 3D library without touching the game logic**. You can **test the zombie AI without opening a browser**. You can **change the AI provider from Gemini to OpenAI** by editing one factory file.

### The four layers of this project

```
┌────────────────────────────────────────────────────────────────────┐
│  PRESENTATION  (src/presentation/)                                  │
│  The user interface layer — HTML overlays and DOM updates only.     │
│  Reads events from the EventBus and updates the HUD, menus, etc.   │
│  ✅ Can use: DOM, HTML, CSS, browser events                         │
│  ❌ Cannot use: Three.js, game logic                                │
├────────────────────────────────────────────────────────────────────┤
│  INFRASTRUCTURE  (src/infrastructure/)                              │
│  The "adapter" layer — glues the game to external technologies.     │
│  Contains: Three.js rendering, Gemini API calls, audio system.      │
│  ✅ Can use: Three.js, fetch, Web Audio API, external SDKs          │
│  ❌ Cannot use: DOM elements, game entity logic                     │
├────────────────────────────────────────────────────────────────────┤
│  USE CASES  (src/use-cases/)                                        │
│  The game logic layer — orchestrates what happens and when.         │
│  Contains: GameLoop, PlayerController, ZombieSystem, CombatSystem.  │
│  ✅ Can use: core entities, EventBus                                │
│  ❌ Cannot use: Three.js, DOM, direct AI calls (use Factory)        │
├────────────────────────────────────────────────────────────────────┤
│  CORE / DOMAIN  (src/core/)                                         │
│  The heart of the game — pure data and pure math.                   │
│  Contains: Player, Zombie, Maze, Weapon, EventBus, math utilities.  │
│  ✅ Can use: vanilla JavaScript only                                │
│  ❌ Cannot use: ANYTHING external — not even npm packages           │
└────────────────────────────────────────────────────────────────────┘
```

### The golden rule: dependencies always flow **inward**

```
Infrastructure  ──►  Use Cases  ──►  Core
Presentation    ──►  Use Cases  ──►  Core
```

`Core` never imports from any other layer. `Three.js` never appears outside `src/infrastructure/three/`.

---

## 🏗️ Project Architecture In Depth

### EventBus — The communication backbone

All layers communicate through a **publish/subscribe event bus**. Instead of one layer calling another directly (which would create tight coupling), they emit and listen to named events.

```
PlayerController emits  ──►  PlayerEvents.MOVED  ──►  FirstPersonCamera listens
ZombieSystem emits      ──►  ZombieEvents.ATTACK  ──►  PlayerController listens
ZombieSystem emits      ──►  ZombieEvents.SPAWNED ──►  MazeRenderer listens
```

This means systems don't know about each other — they only know about events.

### GameLoop — The heartbeat

`GameLoop.js` is the master clock. Every frame (up to 60 times per second), it:
1. Calculates `deltaTime` — the time elapsed since the last frame (in seconds).
2. Calls `update(deltaTime)` on every registered system in order.

Registered systems: `PlayerController`, `ZombieSystem`, `CombatSystem`, `LevelManager`.

Using `deltaTime` ensures movement speed is **the same on a 30 FPS machine and a 144 FPS machine**.

### Maze Generation — Recursive Backtracker

The maze is generated procedurally using the **Recursive Backtracking algorithm** (also known as "depth-first search maze generation"):
1. Start at a random cell.
2. Pick a random unvisited neighbour, remove the wall between them.
3. Recurse into that neighbour.
4. Backtrack when stuck. Continue until all cells are visited.

The result is a **perfect maze** (every cell is reachable, with exactly one path between any two cells — no loops). Each cell is encoded as a **4-bit bitmask** where each bit represents one open wall direction (N/S/E/W).

### A* Pathfinding — How zombies navigate

When a zombie decides to `chase` the player, it doesn't just move directly toward them — it uses **A* (A-star) pathfinding** to navigate around walls intelligently:

1. The zombie's world position is converted to a **grid cell coordinate**.
2. `AStar.findPath(grid, zombieCell, playerCell)` returns a list of cells to walk through.
3. The zombie moves toward the next cell in the path each frame.
4. When it reaches that cell, it advances to the next one.
5. The path is **recalculated** whenever the zombie changes AI state.

### Player collision — Sliding against walls

The player moves with **axis-separated collision detection** to enable smooth sliding:
1. Attempt to move fully (both X and Z axes simultaneously).
2. Check if the new X position collides with a wall → if yes, revert only X.
3. Check if the new Z position collides with a wall → if yes, revert only Z.

This means walking diagonally into a corner wall doesn't stop you dead — you **slide** along the surface.

---

## 🤖 How the AI Zombie System Works

This is the most unique technical feature of the project. Each zombie's decision-making is powered by a **live call to Google Gemini**, a large language model (LLM). Here is the full pipeline:

### Step-by-step: one zombie AI tick

```
Every 60 frames (≈ once per second at 60 FPS)
       │
       ├─ 1. BUILD PERCEPTION STRING
       │       Collect: distance to player, zombie HP, current state
       │       Format: compact text → "dist:12.40, hp:80, state:idle"
       │       (minimises tokens sent to the API = lower cost)
       │
       ├─ 2. LOAD CONTEXT  (ContextLoader.js)
       │       Reads:
       │         skills/zombie-behavior.md   ← System prompt + JSON schema
       │         knowledge/game-lore.md      ← World rules (loaded for context)
       │         knowledge/entities.md       ← Entity stats
       │       Merges them into one "fullContext" string
       │       (this is a simplified RAG — Retrieval-Augmented Generation)
       │
       ├─ 3. CALL MODEL  (AIModelFactory → GeminiAdapter)
       │       POST https://generativelanguage.googleapis.com/…
       │       model:          gemini-2.0-flash-lite
       │       maxOutputTokens: 128   (zombie JSON is < 60 tokens)
       │       temperature:    0      (deterministic — same input = same output)
       │       thinkingBudget: 0      (disables hidden reasoning tokens)
       │
       ├─ 4. PARSE JSON RESPONSE
       │       { "state": "chase", "thought": "Brains detected nearby" }
       │
       └─ 5. APPLY TO DOMAIN
               zombie.setAIState("chase")      → updates the Zombie entity
               EventBus.emit(ZombieEvents.STATE_CHANGED, …)
               → Three.js mesh begins following A* path toward player
```

### Proximity override (safety net)

The AI tick runs once per second, but movement runs at 60 FPS. If a zombie gets very close to the player **between** AI ticks, the `_updateMovement` method **automatically forces `attack` state** regardless of what the AI said. This prevents a zombie from walking through you without attacking.

### Why RAG? (Retrieval-Augmented Generation)

Instead of hardcoding personality and rules directly in JavaScript strings (which would be hard to update and would violate the architecture), the system **loads `.md` files at runtime** and injects them as the AI's "system prompt". This means:

- Changing zombie behaviour = edit `skills/zombie-behavior.md`. No code changes needed.
- Adding world lore = edit `knowledge/game-lore.md`.
- Adding a new NPC type = create a new `.md` prompt file.

### Token optimisation

| Setting | Value | Reason |
|---|---|---|
| Model | `gemini-2.0-flash-lite` | Cheapest & fastest Gemini tier |
| `maxOutputTokens` | `128` | JSON state fits in < 60 tokens; hard cap prevents runaway |
| `temperature` | `0` | Deterministic — no sampling overhead, no retries needed |
| `thinkingBudget` | `0` | Suppresses hidden Chain-of-Thought tokens (saves cost) |

### Graceful fallback

If the Gemini API is unavailable, times out, or returns invalid JSON, the system catches the error and falls back to `{ "state": "chase" }` without freezing the game. The render loop **always runs** at 60 FPS regardless of AI call status.

---

## 📁 Full File Reference

```
game/
├── index.html                           # Single HTML page that boots the app
├── package.json                         # Project metadata + dependencies
├── vite.config.js                       # Build config + path aliases (@/, @config/)
├── .env                                 # Secret keys — git-ignored, never commit
├── .gitignore                           # Files excluded from Git
├── CLAUDE.md                            # Rules for AI coding agents on this project
├── .ai-architecture.md                  # Machine-readable architecture contract
│
├── src/                                 # All JavaScript source code
│   ├── main.js                          # Bootstrap — wires all layers together
│   ├── style.css                        # Global styles and HUD base styles
│   │
│   ├── core/                            # ════ DOMAIN LAYER ════
│   │   │                                # Zero external dependencies allowed here
│   │   ├── EventBus.js                  # Pub/sub event bus + all event name enums
│   │   │                                # (PlayerEvents, ZombieEvents, LevelEvents…)
│   │   │
│   │   ├── entities/                    # Domain entities — pure data + domain logic
│   │   │   ├── GameEntity.js            # Base class: id, type, position, rotation, active flag
│   │   │   ├── Player.js                # Player: health, lives, ammo, scans, yaw/pitch
│   │   │   │                            # Methods: takeDamage, respawn, consumeAmmo,
│   │   │   │                            #          startReload, finishReload, applyMouseLook
│   │   │   ├── Zombie.js                # Zombie: HP, speed, attackRange, damage, aiState
│   │   │   │                            # States: idle | chase | attack | flee
│   │   │   ├── Weapon.js                # Weapon: damage, fireRate, ammo, range
│   │   │   ├── Projectile.js            # Projectile: origin, direction, speed, damage
│   │   │   └── Maze.js                  # Maze: procedural generation (recursive backtracker)
│   │   │                                # Grid encoded as 4-bit bitmask per cell (N/S/E/W walls)
│   │   │
│   │   └── math/                        # Pure math utilities (no dependencies)
│   │       ├── Vector3Utils.js          # add, subtract, scale, normalize, distance
│   │       └── AStar.js                 # A* pathfinding on the maze grid
│   │
│   ├── use-cases/                       # ════ USE CASE LAYER ════
│   │   │                                # Game logic — no Three.js, no DOM allowed
│   │   ├── GameLoop.js                  # Master tick scheduler using requestAnimationFrame
│   │   │                                # Computes deltaTime, calls update() on all systems
│   │   ├── PlayerController.js          # Translates WASD/mouse input → Player entity mutations
│   │   │                                # Handles: movement, collision, shooting, reloading, scan
│   │   │                                # Also handles: respawn on death, exit detection
│   │   ├── ZombieSystem.js              # Spawns zombies, runs AI ticks via Gemini, moves them
│   │   │                                # Pathfinds with A*, handles attack/flee/chase/idle movement
│   │   ├── CombatSystem.js              # Hit detection, damage events, death processing
│   │   ├── AgentBehavior.js             # Agent registry + skill result applicator
│   │   └── LevelManager.js              # Generates maze, places entrance/exit, triggers events
│   │
│   ├── infrastructure/                  # ════ INFRASTRUCTURE LAYER ════
│   │   │
│   │   ├── three/                       # All Three.js code lives here
│   │   │   ├── SceneManager.js          # Creates THREE.Scene, WebGLRenderer, canvas setup
│   │   │   ├── RenderLoop.js            # requestAnimationFrame wrapper — calls scene.render()
│   │   │   ├── MazeRenderer.js          # Reads Maze domain entity → builds 3D geometry
│   │   │   │                            # Creates wall/floor/ceiling meshes, entrance/exit markers
│   │   │   ├── MazeTextureFactory.js    # Generates procedural wall and floor textures (canvas 2D)
│   │   │   ├── FirstPersonCamera.js     # Pointer-lock setup, mouse-look, camera sync with Player
│   │   │   ├── CombatRenderer.js        # Visualises projectile meshes and bullet-flying animation
│   │   │   └── LightingSetup.js         # Ambient light + directional shadow-casting light
│   │   │
│   │   ├── ai/                          # AI integration (decoupled from use cases)
│   │   │   ├── ModelFactory.js          # Factory pattern — creates Gemini/OpenAI/Local adapters
│   │   │   │                            # Handles token config, API calls, error fallback
│   │   │   └── ContextLoader.js         # Loads skills/*.md + knowledge/*.md for RAG context
│   │   │
│   │   ├── audio/                       # Web Audio API integration
│   │   │   └── SoundManager.js          # Manages spatial audio: gunshots, groans, hits, UI sounds
│   │   │
│   │   └── skills/                      # External skill connectors (extensibility layer)
│   │       ├── AgentSkillsBridge.js     # Factory for HTTP / Shell adapter connectors
│   │       └── SkillAdapter.js          # Base adapter interface definition
│   │
│   └── presentation/                    # ════ PRESENTATION LAYER ════
│       │                                # DOM only — no Three.js here
│       ├── HUD.js                       # General on-screen overlay management
│       ├── PlayerHUD.js                 # Health bar, ammo counter, lives, scans, crosshair
│       └── InputHandler.js             # Keyboard + mouse event abstraction
│                                        # Tracks held keys via a Set — exposes isPressed(code)
│
├── skills/                              # LLM system prompts (loaded at runtime, not compiled in)
│   ├── zombie-behavior.md               # Zombie AI: state machine rules + JSON response schema
│   └── npc-assistant.md                 # Merchant NPC personality prompt
│
├── knowledge/                           # RAG knowledge base (injected into AI context)
│   ├── game-lore.md                     # World lore: Z-Maze Shooting, factions, world rules
│   └── entities.md                      # Entity stats: Villager, Guard, Bandit, etc.
│
├── config/
│   └── settings.js                      # Global constants (canvas ID, debug flag, cell size…)
│
├── assets/                              # 3D models and textures (GLTF, PNG)
└── public/                              # Static assets served directly (favicon, etc.)
```

---

## 🔧 Debug Mode

Set `VITE_DEBUG=true` in `.env` (or in `config/settings.js`) to enable debug mode.

All key systems are exposed on the browser's `window._debug` object:

```js
// See all active AI agents
window._debug.agentBehavior.all()

// Total game time elapsed (seconds)
window._debug.gameLoop.elapsedTime

// Subscribe to any EventBus event live
window._debug.eventBus.on('zombie:moved', console.log)
window._debug.eventBus.on('player:fired', console.log)

// Inspect player domain entity
window._debug.player

// Inspect zombie system
window._debug.zombieSystem

// Inspect combat system
window._debug.combatSystem
```

The Gemini token usage per AI call is also logged to the console:

```
[Gemini] tokens used: 47 | response: { "state": "chase", "thought": "Brains detected nearby" }
```

---

## ➕ Adding New NPCs / Extending the Game

The architecture is designed so that adding a new NPC type requires **no changes to existing systems**:

### Step 1 — Write the AI prompt
Create `skills/my-npc.md` with the system prompt and JSON response schema.

### Step 2 — Add knowledge (optional)
Add lore or stats to `knowledge/` if the NPC needs world context.

### Step 3 — Create the domain entity
Create `src/core/entities/MyNpc.js` extending `GameEntity`.

```js
import { GameEntity } from './GameEntity.js';

export class MyNpc extends GameEntity {
  /** @param {string} id */
  constructor(id) {
    super(id, 'my-npc');
    this.state = 'idle';
  }
}
```

### Step 4 — Create the use-case system
Create `src/use-cases/MyNpcSystem.js` that calls `ContextLoader` and `AIModelFactory`:

```js
import { AIModelFactory, AIProvider } from '@/infrastructure/ai/ModelFactory.js';
import { ContextLoader } from '@/infrastructure/ai/ContextLoader.js';

export class MyNpcSystem {
  async update(deltaTime) {
    const context = this.contextLoader.loadFullContext('my-npc');
    const adapter = AIModelFactory.create(AIProvider.GEMINI);
    const result  = await adapter.complete(context, perceptionString);
    // parse result and apply to entity
  }
}
```

### Step 5 — Register in GameLoop and bind a mesh
In `main.js`, register `MyNpcSystem` with the `GameLoop` and add a listener in `MazeRenderer` to create a Three.js mesh for it.

---

## 📐 Architecture Rules (for Contributors)

These rules are enforced by `CLAUDE.md` and `.ai-architecture.md`. Any AI coding agent (Antigravity, Cursor, Copilot) working on this project must follow them.

| Rule | Detail |
|---|---|
| 🚫 No Three.js outside `src/infrastructure/three/` | Ever. Any Three.js import outside this folder breaks the architecture. |
| 🚫 No DOM APIs outside `src/presentation/` | Use EventBus to communicate DOM changes instead. |
| 🚫 No hardcoded system prompts in `.js` | Always load via `ContextLoader` from `skills/` and `knowledge/`. |
| 🚫 No direct model instantiation | Always use `AIModelFactory.create(AIProvider.GEMINI)`. |
| 🚫 No LLM calls outside `try/catch` | The render loop must **never** freeze. All AI calls are async with graceful fallback. |
| ✅ JSDoc on every function parameter | No untyped parameters. Enforced across all files. |
| ✅ `.env` stays in `.gitignore` | No API keys, ever, in source code or Git history. |

### Pre-commit checklist

- [ ] JSDoc types on every function parameter.
- [ ] System prompts loaded via `ContextLoader` (never inline strings).
- [ ] AI model created via `AIModelFactory`, never instantiated directly.
- [ ] No new `import * as THREE` outside `src/infrastructure/three/`.
- [ ] LLM calls wrapped in `try/catch` that falls back gracefully (no frozen frames).
- [ ] `.env` still in `.gitignore`.

---

## 🌍 Game World & Lore

The game is set in **Z-Maze Shooting**, a medieval kingdom crumbling after the death of its last king. Players begin in the **"Aldea del Inicio"** — a small survivor camp at the maze entrance.

### Factions

| Faction | Role |
|---|---|
| **Guardianes de la Luz** | Paladins protecting the main village from undead |
| **Los Renegados** | Bandits that ambush in dark forest corridors |
| **Los Antiguos** | Neutral magic beings that grant legendary quests |

### World rules (enforced in NPC AI prompts)
- All NPCs refer to the player as **"Viajero/Viajera"** (Traveler).
- Currency is the **"Moneda de Oro Aethel"**.
- Magic is rare, unpredictable, and dangerous.
- Zombies are driven by a single directive: **hunt the player**.

---

## 📚 Further Reading

| File | Purpose |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | Strict rules for AI coding agents working on this repo |
| [`.ai-architecture.md`](.ai-architecture.md) | Machine-readable architecture contract with layer diagram |
| [`src/infrastructure/ai/ModelFactory.js`](src/infrastructure/ai/ModelFactory.js) | Gemini adapter + token optimisation config |
| [`src/infrastructure/ai/ContextLoader.js`](src/infrastructure/ai/ContextLoader.js) | RAG context assembly logic |
| [`src/use-cases/ZombieSystem.js`](src/use-cases/ZombieSystem.js) | Full zombie AI + A* pathfinding system |
| [`src/core/math/AStar.js`](src/core/math/AStar.js) | A* pathfinding implementation |
| [`skills/zombie-behavior.md`](skills/zombie-behavior.md) | Zombie NPC system prompt + JSON schema |
| [`knowledge/game-lore.md`](knowledge/game-lore.md) | World lore injected into every NPC context |

---

*Built with ❤️ using Three.js, Vite, and Google Gemini.*
