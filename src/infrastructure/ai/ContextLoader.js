// Vite Specific: Importing markdown content directly as raw strings.
// Note: Depending on your Vite config setup, you might need to alias these 
// or ensure they are properly bundled if loaded dynamically.
import npcSightSkill from '../../../../skills/npc-assistant.md?raw';
import gameLore from '../../../../knowledge/game-lore.md?raw';
import entitiesInfo from '../../../../knowledge/entities.md?raw';

/**
 * Loads skills/*.md and knowledge/*.md content for RAG injection.
 */
export class ContextLoader {
    /**
     * Reads a specific skill (System Prompt)
     * @param {string} skillName 
     * @returns {string} The raw markdown content
     */
    static loadSkill(skillName) {
        // Fallback or dynamic logic depending on your needs.
        // For pedagogical purposes, we use static imports here.
        if (skillName === 'npc-assistant') {
            return npcSightSkill;
        }
        return "You are a helpful NPC in Aethelgard.";
    }

    /**
     * Reads the entire game knowledge base (Lore + Entities)
     * @returns {string} Combined knowledge contexts
     */
    static loadKnowledge() {
        return `${gameLore}\n\n---\n\n${entitiesInfo}`;
    }

    /**
     * Merges Skill (System Prompt) + Knowledge (RAG)
     * @param {string} skillName 
     * @returns {string} Full combined Context for the Model
     */
    static loadFullContext(skillName) {
        const skill = this.loadSkill(skillName);
        const knowledge = this.loadKnowledge();
        return `${skill}\n\n## Base de conocimiento (RAG):\n\n${knowledge}`;
    }
}
