import { MODULE_NAME } from "../settings.js";

// Regex to find injected comfyinject <img> tags in message text
const IMG_TAG_REGEX = /<img class="comfyinject-image"[^>]*>/g;

/**
 * Prompt interceptor — called by SillyTavern before every generation.
 * Replaces <img> tags in outgoing messages with a token-efficient
 * [[IMG: prompt | seed ]] token so the LLM can reference its previous
 * visual descriptions and seed for continuity.
 *
 * Uses structuredClone internally via ST's chat array so the real
 * chat history is never modified — all changes are ephemeral.
 *
 * @param {object[]} chat - The mutable chat array passed by ST's interceptor system
 * @param {number} contextSize - Current context size in tokens
 * @param {Function} abort - Call this to cancel generation entirely
 * @param {string} type - The generation trigger type (e.g. 'normal', 'swipe', 'quiet')
 */
globalThis.comfyInjectInterceptor = async function(chat, contextSize, abort, type) {
    // Skip quiet generations (summaries, silent background calls etc)
    // so we don't accidentally interfere with other extensions
    if (type === "quiet") return;

    const context = SillyTavern.getContext();
    const metadata = context.chatMetadata[MODULE_NAME];

    // If no images have been generated in this chat yet, nothing to do
    if (!metadata) return;

    for (let i = 0; i < chat.length; i++) {
        const message = chat[i];

        // Only process bot messages that contain an img tag
        if (message.is_user) continue;
        if (!message.mes || !IMG_TAG_REGEX.test(message.mes)) continue;

        // Reset regex lastIndex since we're reusing it across iterations
        IMG_TAG_REGEX.lastIndex = 0;

        // Look up the saved prompt and seed for this message index
        const imageData = metadata[i];

        if (!imageData) {
            // No metadata for this message — strip the img tag entirely
            // to avoid sending a raw HTML tag to the LLM
            message.mes = message.mes.replace(IMG_TAG_REGEX, "[image]");
            IMG_TAG_REGEX.lastIndex = 0;
            continue;
        }

        const { prompt, seed } = imageData;

        // Replace the <img> tag with the compact token the LLM can read
        const compactToken = `[[IMG: ${prompt} | ${seed} ]]`;
        message.mes = message.mes.replace(IMG_TAG_REGEX, compactToken);
        IMG_TAG_REGEX.lastIndex = 0;
    }
};