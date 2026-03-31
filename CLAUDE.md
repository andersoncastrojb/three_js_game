# CLAUDE.md — Reglas del Proyecto 3D & AI Agents

Este archivo contiene las reglas estrictas que cualquier asistente de IA (Claude Code, Antigravity, Cursor) debe seguir al desarrollar en este ecosistema híbrido (Arquitectura 3D + IAs Reactivas) para el juego.

---

## 1. ARQUITECTURA — Clean Architecture estricta en JS/3D

La separación de capas es **obligatoria**. El renderizado 3D es un detalle de infraestructura, no el núcleo de la aplicación.

| Capa | Ruta | Restricción |
|---|---|---|
| Dominio | `src/core/` | **Cero** dependencias externas. Sin Three.js, sin DOM, sin LLMs. |
| Casos de uso | `src/use-cases/` | Solo importa desde `src/core/`. Orquesta el estado. |
| Presentación | `src/presentation/` | Solo DOM/HTML/CSS/Eventos. Sin Three.js. |
| Infraestructura | `src/infrastructure/` | Adaptadores de Three.js, ModelFactory AI, y ContextLoader RAG. |

**Regla de oro: la dependencia siempre fluye hacia `core`.**
Si `core/` sabe de Three.js o sabe que Gemini está procesando un texto, estás violando esta regla.

---

## 2. ESTÁNDARES DE CÓDIGO — JavaScript + JSDoc

Debido a que este entorno no usa Python/TypeHints o TypeScript, la validación estricta de tipos de todos los parámetros mediante JSDoc es innegociable.

- **Tipado estricto**: Toda función y parámetro **DEBE** tener su tipo definido.
- **Validación Pydantic-like**: Usa `SkillResultValidator.js` o funciones equivalentes para sanear salidas JSON de los LLMs.
- **Try/except explícito**: Nunca utilices un `catch (e) {}` vacío que oculte fallos del LLM o de red.

---

## 3. MODELOS DE IA — Factory Pattern y Context Loader (RAG Simplificado)

Hemos adoptado el patrón de Desacoplamiento Total.

- **Factory Pattern**: **NUNCA** instancies un modelo (como Gemini o OpenAI) directamente en los casos de uso. Siempre utiliza `AIModelFactory.create(AIProvider.GEMINI)`.
- **Enum de Proveedores**: Importa el enum `AIProvider` desde el código base, simulando el enum dinámico de Python.
- **RAG Simplificado**: NO hardcodees "System Prompts" en JS. Utiliza la clase `ContextLoader` para inyectar recursos en tiempo de ejecución.

### Flujo de RAG exigido para NPCs:
```javascript
import { ContextLoader } from '@/infrastructure/ai/ContextLoader.js';
import { AIModelFactory, AIProvider } from '@/infrastructure/ai/ModelFactory.js';

// 1. Cargar conocimiento y System Prompts desde los archivos .md (Skills + Knowledge)
const fullContext = ContextLoader.loadFullContext('npc-assistant');

// 2. Instanciar mediante Factory
const adapter = AIModelFactory.create(AIProvider.GEMINI);

// 3. Completar Inferencia (Debe ser asíncrono y en Try/Catch)
const res = await adapter.complete(fullContext, userInput);
```

---

## 4. ESTRUCTURA DE ALMACENAMIENTO AI ("El Patrón Tierra de Agricultores")

- **`knowledge/`**: Base de datos de texto (.md). Contiene `game-lore.md` o `entities.md`. La IA los leerá vía ContextLoader (`?raw` imports).
- **`skills/`**: Directorio de los *System Prompts* (Ej. `npc-assistant.md`). Define cómo actúa el modelo.
- **`.agent/skills/`**: Instrucciones reservadas exclusivamente para **herramientas de edición como esta** (VSCode, Antigravity, Cursor) para instruir al programador sintético.

---

## 5. RESTRICCIONES DE ENTORNO — Vite

- **Variables de entorno**: Usa el estándar de Vite (`import.meta.env.VITE_GOOGLE_API_KEY`).
- **NUNCA HARDCODEES API KEYS**.
- **.env siempre en .gitignore**.
- No realices imports síncronos enormes de modelos 3D o bibliotecas pesadas en el Main Thread. Usa Web Workers si es necesario.

---

## 6. CHECKLIST ANTES DE CADA COMMIT

- [ ] JSDoc Tipos presentes en todas las funciones.
- [ ] Prompts cargados vía `ContextLoader` (desde `skills/` y `knowledge/`).
- [ ] Modelos inyectados usando `AIModelFactory`, nunca requeridos de forma global.
- [ ] `.env` está en `.gitignore`.
- [ ] Eventos del LLM manejados limpiamente sin congelar el loop de render de Three.js (60 FPS).
