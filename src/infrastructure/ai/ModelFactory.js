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
/**
 * Token-optimised settings for Gemini API calls.
 * - gemini-2.0-flash-lite: fastest + cheapest tier (replaces 2.5-flash)
 * - maxOutputTokens: 128  — zombie state JSON fits easily in < 60 tokens
 * - temperature: 0        — deterministic; no sampling overhead / no re-tries
 * - thinkingBudget: 0     — disables hidden Chain-of-Thought tokens (Flash Thinking feature)
 */
const GEMINI_MODEL    = 'gemini-2.0-flash-lite';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/** @type {Object} Shared generation config injected into every Gemini request */
const GEMINI_GENERATION_CONFIG = {
    temperature: 0,       // fully deterministic — no temperature sampling cost
    maxOutputTokens: 128, // NPC JSON state is < 60 tokens; hard-cap prevents runaway
    topP: 1,              // disable nucleus sampling when temperature = 0
    thinkingConfig: { thinkingBudget: 0 }, // suppress hidden thinking tokens
};

export class AIModelFactory {
    /**
     * Creates the correct AI adapter based on the provider.
     * @param {AIProvider} provider
     * @returns {Object} An object implementing IModelAdapter
     * @throws {Error} If provider is unknown
     */
    static create(provider) {
        switch (provider) {
            case AIProvider.GEMINI:
                console.log('[AIModelFactory] Initializing GeminiAdapter (gemini-2.0-flash-lite, token-optimised)...');
                return {
                    /**
                     * @param {string} system  - System prompt (skill + RAG)
                     * @param {string} user    - Current NPC perception string
                     * @param {Array}  history - Unused for stateless NPC calls
                     * @returns {Promise<{response: string, tokens: number}>}
                     */
                    complete: async (system, user, history = []) => {
                        const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
                        if (!API_KEY) {
                            console.warn('[Gemini] VITE_GOOGLE_API_KEY not set — using fallback state.');
                            return { response: '{ "state": "chase" }', tokens: 0 };
                        }

                        try {
                            const rawResponse = await fetch(`${GEMINI_ENDPOINT}?key=${API_KEY}`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    systemInstruction: { parts: [{ text: system }] },
                                    contents: [{ role: 'user', parts: [{ text: user }] }],
                                    generationConfig: GEMINI_GENERATION_CONFIG,
                                }),
                            });

                            if (!rawResponse.ok) {
                                const errBody = await rawResponse.text();
                                throw new Error(`Gemini HTTP ${rawResponse.status}: ${errBody}`);
                            }

                            const json = await rawResponse.json();
                            const text   = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
                            // Report real token usage so callers / devtools can track spend
                            const tokens = json.usageMetadata?.totalTokenCount ?? 0;

                            if (import.meta.env.VITE_DEBUG === 'true') {
                                console.debug(`[Gemini] tokens used: ${tokens} | response: ${text}`);
                            }

                            return { response: text, tokens };
                        } catch (err) {
                            console.error('[Gemini] Inference failed — using fallback state:', err.message);
                            return { response: '{ "state": "chase" }', tokens: 0 };
                        }
                    },
                };

            case AIProvider.OPENAI:
                return {
                    complete: async (system, user, history = []) => {
                        return { response: 'OpenAI response placeholder', tokens: 15 };
                    },
                };

            case AIProvider.LOCAL:
                return {
                    complete: async (system, user, history = []) => {
                        return { response: 'I am a simple local NPC placeholder.', tokens: 0 };
                    },
                };

            default:
                throw new Error(`AI Provider unknown: ${provider}`);
        }
    }
}
