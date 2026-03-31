---
name: frontend-threejs
description: >
    Use this skill when creating, modifying or extending the JS game backend logic.
    Activates for: 'create agent', 'add npc logic', 'refactor AI adapter', 
    'add provider' in the Three.js Vite environment.
compatibility: ES6+, Vite, Three.js
---

# Objetivo

Construir la capa de Integración de IA para NPCs dentro de un entorno 3D, manteniendo la Clean Architecture estricta y utilizando Factory Pattern de Modelos de IA.

## Instrucciones Clave de Arquitectura

1. **Separar en Capas JS**: 
   - `src/core` (Dominio Puro, sin frameworks ni DOM)
   - `src/use-cases` (Orquestación del estado del juego)
   - `src/infrastructure` (Three.js WebGL rendering y LLM API Clients)
2. **AI Factory**: Siempre inicializar modelos de IA mediante el `ModelFactory`.
3. **Tipado Estricto**: Todo JS debe estar fuertemente tipado con tags JSDoc (`/** @param {string} type */`).

## Restricciones Fundamentales

- NUNCA mezcles Three.js con la lógica de negocio core o la lógica de inferencia del LLM.
- NUNCA hardcodees Prompts del Sistema dentro de código .js. Lee usando fetch u otro método de carga desde la carpeta `skills/` y la carpeta `knowledge/` (RAG simplificado).
- Protege el Loop de Render. Las llamadas de inferencia LLM al `ModelFactory` deben ser siempre asíncronas, estar dentro de bloques try/catch y resolver limpiamente si la API falla sin congelar el juego a 60 FPS.
