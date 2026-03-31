# Three.js Clean Architecture Game

A modular, domain-driven 3D game scaffold built with **Vite** + **Three.js**, following **Clean Architecture** principles. The render loop is strictly decoupled from business logic and AI agent interactions.

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) – a live 3D scene renders immediately.

---

## 📦 Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Production bundle → `dist/` |
| `npm run preview` | Preview production build locally |

---

## 🏗️ Architecture

```
src/
├── core/                   # Domain – no external deps
│   ├── entities/GameEntity.js
│   ├── math/Vector3Utils.js
│   └── EventBus.js
├── use-cases/              # Business logic – no Three.js
│   ├── AgentBehavior.js
│   └── GameLoop.js
├── infrastructure/
│   ├── three/              # ALL Three.js code lives here
│   │   ├── SceneManager.js
│   │   ├── RenderLoop.js
│   │   └── LightingSetup.js
│   └── skills/             # AI skill adapters
│       ├── SkillAdapter.js
│       └── AgentSkillsBridge.js
├── presentation/           # DOM only – no Three.js
│   ├── HUD.js
│   └── InputHandler.js
└── main.js                 # Bootstrap / wiring

config/
└── settings.js             # Global constants

assets/                     # 3D models, textures (GLTF etc.)
.ai-architecture.md         # Contract for AI agents
```

### Dependency Rule
`Core ← Use Cases ← Infrastructure` and `Core ← Use Cases ← Presentation`  
**Three.js never escapes `src/infrastructure/three/`.**

---

## 🎮 Controls (Demo)

| Key | Action |
|---|---|
| `Space` | Invoke stub skill adapter (shell / agentskills.io) |

---

## 🤖 AI Skills Integration

See [`src/infrastructure/skills/AgentSkillsBridge.js`](src/infrastructure/skills/AgentSkillsBridge.js) for:
- `HttpSkillAdapter` – REST POST to agentskills.io endpoints
- `ShellSkillAdapter` – CLI/skills.sh stub (swap for Node `child_process` in Electron)

AI skill results flow: `SkillAdapter → AgentBehavior → EventBus → Three.js scene`

For full architectural guidelines read [`.ai-architecture.md`](.ai-architecture.md).

---

## 🔧 Debug Mode

In development, global state is exposed on `window._debug`:

```js
window._debug.agentBehavior.all()   // All live agents
window._debug.gameLoop.elapsedTime  // Seconds elapsed
window._debug.eventBus              // Subscribe to any event
```
