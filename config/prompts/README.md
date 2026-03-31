# Agent Skill Prompts

Place AI agent prompt files here.
Each file should be a `.md` or `.txt` document loaded at runtime via fetch().
Never hardcode prompt text inside JavaScript source files.

Example usage in infrastructure/skills:
  const prompt = await fetch('/config/prompts/agent-move.md').then(r => r.text());
