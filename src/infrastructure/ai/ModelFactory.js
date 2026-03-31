/**
 * Enum for AI Providers
 * @enum {string}
 */
export const AIProvider = {
    GEMINI: 'gemini',
    OPENAI: 'openai',
    LOCAL: 'local' // Fallback for testing without keys
};

/**
 * Interface for AI Adapters (JSDoc representation)
 * 
 * @interface IModelAdapter
 * @function complete
 * @param {string} system - System prompt (Context + Instructions)
 * @param {string} user - User query
 * @param {Array<Object>} [history] - Conversation history
 * @returns {Promise<{response: string, tokens: number}>}
 */

/**
 * Factory for creating AI Adapters without coupling
 */
export class AIModelFactory {
    /**
     * Creates the correct AI adapter based on the provider
     * @param {AIProvider} provider 
     * @returns {Object} An object implementing IModelAdapter
     * @throws {Error} If provider is unknown
     */
    static create(provider) {
        switch (provider) {
            case AIProvider.GEMINI:
                // Return an instance of GeminiAdapter (to be implemented)
                console.log("[AIModelFactory] Initializing GeminiAdapter...");
                return {
                    complete: async (system, user, history = []) => {
                        // This should call the real Gemini API via fetch or SDK
                        return { response: "Gemini response placeholder", tokens: 10 };
                    }
                };
            case AIProvider.OPENAI:
                // Return an instance of OpenAIAdapter (to be implemented)
                return {
                    complete: async (system, user, history = []) => {
                        return { response: "OpenAI response placeholder", tokens: 15 };
                    }
                };
            case AIProvider.LOCAL:
                // Return an instance of LocalMockAdapter
                return {
                    complete: async (system, user, history = []) => {
                        return { response: "I am a simple local NPC placeholder.", tokens: 0 };
                    }
                };
            default:
                throw new Error(`AI Provider unknown: ${provider}`);
        }
    }
}
