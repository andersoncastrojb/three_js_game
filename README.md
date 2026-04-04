# 🧟 Aethelgard — 3D Maze Escape

> A first-person 3D maze-escape game with **AI-powered zombie NPCs**, built on
> **Three.js + Vite** following strict **Clean Architecture** principles.

---

## 🎮 What is this game?

You are a survivor trapped inside the procedurally generated dungeons of
**Aethelgard** — a kingdom fallen to shadow after the death of its last king.
Navigate the maze, shoot down undead hordes, and escape alive.

### Core gameplay loop

```
Player spawns at maze entrance
    │
    ├─► Explores first-person maze (WASD + mouse-look)
    │
    ├─► Zombies react in real-time via Google Gemini LLM
    │       idle → chase → attack → flee  (JSON state machine)
    │
    ├─► Player shoots projectiles (Left-click / Space)
    │
    └─► Reach the exit OR die to zombie damage
```

### Key features

| Feature | Detail |
|---|---|
| 🧩 Procedural maze | Recursive-backtracker algorithm, configurable grid size |
| 🧟 AI zombies | Each zombie's decision (idle / chase / attack / flee) is driven by **Google Gemini 2.0 Flash Lite** at runtime |
| 🔫 Combat | Raycaster-based projectile system, hit detection, HP management |
| 🎯 First-person camera | Pointer-lock mouse-look, collision-aware movement |
| 📟 HUD | Live health, ammo, lives, and crosshair overlay |
| 🌍 Game world | Factions, lore, and NPC rules loaded as `.md` knowledge files (RAG) |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| 3D Renderer | [Three.js](https://threejs.org/) v0.183 |
| Build tool | [Vite](https://vitejs.dev/) v8 (ESM, HMR) |
| AI provider | Google Gemini API (`gemini-2.0-flash-lite`) |
| Language | Vanilla JavaScript (ES2022 modules, strict JSDoc typing) |
| Runtime | Browser (no Node.js runtime required) |

---

## 🚀 Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure the API key

Create a `.env` file at the project root (already provided as a template):

```env
VITE_GOOGLE_API_KEY=your_google_gemini_api_key_here
VITE_DEBUG=false
```

> Get a free key at [aistudio.google.com](https://aistudio.google.com).  
> ⚠️ `.env` is git-ignored — **never commit your key**.

### 3. Start the dev server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) — the 3D scene loads immediately.

### Available scripts

| Command | Description |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Production bundle → `dist/` |
| `npm run preview` | Serve the production build locally |

---

## 🏗️ Architecture Overview

This project follows **Clean Architecture** (by Robert C. Martin).  
The render loop is a *detail* — not the center of the app.

```
┌─────────────────────────────────────────────────────────────────┐
│  PRESENTATION  (src/presentation/)                               │
│  DOM overlays · HUD · PlayerHUD · InputHandler                   │
│  reads EventBus → updates DOM only, never touches Three.js       │
├─────────────────────────────────────────────────────────────────┤
│  USE CASES  (src/use-cases/)                                     │
│  GameLoop · AgentBehavior · LevelManager                         │
│  CombatSystem · PlayerController · ZombieSystem                  │
│  pure JS — zero Three.js, zero DOM                               │
├─────────────────────────────────────────────────────────────────┤
│  CORE / DOMAIN  (src/core/)                                      │
│  GameEntity · Player · Zombie · Maze · Vector3Utils · EventBus   │
│  zero external dependencies                                      │
├─────────────────────────────────────────────────────────────────┤
│  INFRASTRUCTURE  (src/infrastructure/)                           │
│  ├── three/   SceneManager · RenderLoop · MazeRenderer           │
│  │            FirstPersonCamera · ProjectileRaycaster             │
│  │            LightingSetup · MazeTextureFactory                  │
│  ├── ai/      ModelFactory · ContextLoader                       │
│  └── skills/  AgentSkillsBridge · SkillAdapter                   │
└─────────────────────────────────────────────────────────────────┘
```

### The golden rule: dependency always flows **inward**

```
Infrastructure  ──►  Use Cases  ──►  Core
Presentation    ──►  Use Cases  ──►  Core
```

`Core` never imports from any other layer.  
`Three.js` never escapes `src/infrastructure/three/`.

---

## 📁 Full File Reference

```
game/
├── src/
│   ├── main.js                          # Bootstrap — wires all layers
│   ├── style.css                        # Global styles / HUD base
│   │
│   ├── core/                            # DOMAIN — zero external deps
│   │   ├── EventBus.js                  # Pub/sub bus (cross-layer comms)
│   │   ├── entities/
│   │   │   ├── GameEntity.js            # Base class (id, position, HP)
│   │   │   ├── Player.js                # Player state (health, ammo, lives)
│   │   │   ├── Zombie.js                # Zombie state (HP, AI state enum)
│   │   │   └── Maze.js                  # Procedural maze (recursive backtracker)
│   │   └── math/
│   │       └── Vector3Utils.js          # Pure 3D math helpers
│   │
│   ├── use-cases/                       # BUSINESS LOGIC — no Three.js, no DOM
│   │   ├── GameLoop.js                  # Tick scheduler, delta-time system registry
│   │   ├── AgentBehavior.js             # Agent registry + skill result applicator
│   │   ├── LevelManager.js              # Triggers maze generation via EventBus
│   │   ├── CombatSystem.js              # Hit detection, damage, death events
│   │   ├── PlayerController.js          # Movement, collision, shooting logic
│   │   └── ZombieSystem.js              # Zombie AI tick + Gemini inference calls
│   │
│   ├── infrastructure/
│   │   ├── three/                       # ALL Three.js lives here
│   │   │   ├── SceneManager.js          # Scene + camera + renderer setup
│   │   │   ├── RenderLoop.js            # requestAnimationFrame wrapper
│   │   │   ├── MazeRenderer.js          # Builds 3D geometry from Maze entity
│   │   │   ├── MazeTextureFactory.js    # Procedural wall/floor textures
│   │   │   ├── FirstPersonCamera.js     # Pointer-lock, mouse-look, camera sync
│   │   │   ├── ProjectileRaycaster.js   # Bullet ray → zombie hit detection
│   │   │   └── LightingSetup.js         # Ambient + directional lights
│   │   │
│   │   ├── ai/                          # AI integration adapters
│   │   │   ├── ModelFactory.js          # Factory → creates Gemini/OpenAI/Local adapters
│   │   │   └── ContextLoader.js         # Loads skills/*.md + knowledge/*.md for RAG
│   │   │
│   │   └── skills/                      # External skill connectors
│   │       ├── AgentSkillsBridge.js     # Factory for HTTP / Shell adapters
│   │       └── SkillAdapter.js          # Base adapter interface
│   │
│   └── presentation/                    # DOM ONLY — no Three.js
│       ├── HUD.js                       # General on-screen overlay
│       ├── PlayerHUD.js                 # Health bar, ammo counter, crosshair, lives
│       └── InputHandler.js             # Keyboard + mouse event abstraction
│
├── skills/                              # System prompts for LLM NPCs
│   ├── zombie-behavior.md               # Zombie state machine prompt + JSON schema
│   └── npc-assistant.md                 # Merchant NPC personality prompt
│
├── knowledge/                           # RAG knowledge base (injected into context)
│   ├── game-lore.md                     # World lore: Aethelgard, factions, rules
│   └── entities.md                      # Entity stats: Villager, Guard, Bandit
│
├── config/
│   └── settings.js                      # Global constants (canvas ID, debug flag, etc.)
│
├── assets/                              # 3D models, textures (GLTF, PNG, etc.)
├── public/                              # Static assets served as-is
│
├── .env                                 # Secret keys (git-ignored)
├── .gitignore
├── CLAUDE.md                            # Rules for AI coding agents on this project
├── .ai-architecture.md                  # Machine-readable architecture contract
├── vite.config.js                       # Path aliases (@/, @config/)
└── package.json
```

---

## 🤖 How the AI NPC System Works

The zombie AI runs a **Retrieval-Augmented Generation (RAG)** pipeline on every
decision tick. Here is the complete data flow:

```
Every N frames (ZombieSystem.js)
    │
    ├─ 1. BUILD PERCEPTION STRING
    │       distance to player, zombie HP, current state
    │       → compact text: "distance:12.4, hp:80, state:idle"
    │
    ├─ 2. LOAD CONTEXT  (ContextLoader.js)
    │       skills/zombie-behavior.md   ← System Prompt + JSON schema
    │       knowledge/game-lore.md      ← World rules
    │       knowledge/entities.md       ← Entity stats
    │       → merged into one "fullContext" string
    │
    ├─ 3. CALL MODEL  (ModelFactory.js → GeminiAdapter)
    │       POST https://generativelanguage.googleapis.com/…
    │       model:          gemini-2.0-flash-lite
    │       maxOutputTokens: 128
    │       temperature:    0   (deterministic, no sampling cost)
    │       thinkingBudget: 0   (disables hidden reasoning tokens)
    │
    ├─ 4. PARSE RESPONSE
    │       { "state": "chase", "thought": "Brains detected nearby" }
    │
    └─ 5. APPLY TO DOMAIN
            Zombie.setState("chase")
            EventBus.emit(ZombieEvents.MOVED, …)
            → Three.js mesh follows new position
```

### Adding a new NPC type

1. Create `skills/my-npc.md` — write the system prompt and JSON schema.
2. Add knowledge to `knowledge/` if needed.
3. Create `src/core/entities/MyNpc.js` extending `GameEntity`.
4. Create `src/use-cases/MyNpcSystem.js` — call `ContextLoader.loadFullContext('my-npc')`.
5. Register the system in `GameLoop` and bind a Three.js mesh in `main.js`.

### Token optimization summary

| Setting | Value | Reason |
|---|---|---|
| Model | `gemini-2.0-flash-lite` | Cheapest & fastest Gemini tier |
| `maxOutputTokens` | `128` | JSON state fits in < 60 tokens |
| `temperature` | `0` | Deterministic; no retry needed |
| `thinkingBudget` | `0` | Suppresses hidden CoT tokens |

---

## 🎮 Controls

| Input | Action |
|---|---|
| `W A S D` | Move forward / left / backward / right |
| `Mouse` | Look around (pointer-lock) |
| `Left-click` | Shoot projectile |
| `Space` | Shoot projectile (keyboard alternative) |
| `Esc` | Release pointer lock |

Click the canvas once to activate pointer-lock and enable mouse-look.

---

## 🔧 Debug Mode

Set `VITE_DEBUG=true` in `.env` (or `config/settings.js`) to activate.

All key systems are accessible from the browser console:

```js
// All live agents
window._debug.agentBehavior.all()

// Total elapsed seconds
window._debug.gameLoop.elapsedTime

// Subscribe to any EventBus event
window._debug.eventBus.on('zombie:moved', console.log)

// Player state
window._debug.player

// Zombie system
window._debug.zombieSystem

// Combat system
window._debug.combatSystem
```

Gemini token usage per call is also printed to the console when debug mode is on:

```
[Gemini] tokens used: 47 | response: { "state": "chase", "thought": "…" }
```

---

## 📐 Architecture Rules (for contributors)

These rules are enforced by `CLAUDE.md` and `.ai-architecture.md`.

1. **No Three.js outside `src/infrastructure/three/`** — ever.
2. **No DOM APIs outside `src/presentation/`** — ever.
3. **No hardcoded system prompts in `.js`** — use `ContextLoader` to load `.md` files.
4. **No direct model instantiation** — always use `AIModelFactory.create(AIProvider.GEMINI)`.
5. **All LLM calls must be `async/await` inside `try/catch`** — the render loop must never freeze.
6. **All functions must have JSDoc type annotations** — no untyped parameters.
7. **`.env` stays in `.gitignore`** — no API keys in source control.

### Pre-commit checklist

- [ ] JSDoc types on every function parameter.
- [ ] System prompts loaded via `ContextLoader` (never inline strings).
- [ ] AI model created via `AIModelFactory`, never instantiated directly.
- [ ] No new `import * as THREE` outside `src/infrastructure/three/`.
- [ ] LLM calls wrapped in `try/catch` that falls back gracefully.
- [ ] `.env` still in `.gitignore`.

---

## 🌍 Game World (Lore Summary)

The game is set in **Aethelgard**, a medieval kingdom in ruin.

| Faction | Role |
|---|---|
| **Guardianes de la Luz** | Paladins protecting the main village |
| **Los Renegados** | Bandits that ambush in dark forests |
| **Los Antiguos** | Neutral magic beings that grant legendary quests |

NPCs address the player as **"Viajero/Viajera"** (Traveler).  
Currency: **Moneda de Oro Aethel**.  
Magic is rare and dangerous.

---

## 📚 Further Reading

| File | Purpose |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | Strict rules for AI coding agents working on this repo |
| [`.ai-architecture.md`](.ai-architecture.md) | Machine-readable architecture contract with layer diagram |
| [`src/infrastructure/ai/ModelFactory.js`](src/infrastructure/ai/ModelFactory.js) | Gemini adapter + token optimization config |
| [`src/infrastructure/ai/ContextLoader.js`](src/infrastructure/ai/ContextLoader.js) | RAG context assembly |
| [`skills/zombie-behavior.md`](skills/zombie-behavior.md) | Zombie NPC system prompt + JSON schema |
| [`knowledge/game-lore.md`](knowledge/game-lore.md) | World lore injected into every NPC context |
