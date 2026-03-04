import { MARKER_REGEX, processImageMarker, hasImageMarker } from "./parse.js";
import { MODULE_NAME } from "../settings.js";

/**
 * Builds the <img> tag string that gets injected into the message.
 * Stores prompt and seed as data attributes for outbound.js to read.
 * @param {string} imageUrl - The full ComfyUI /view URL
 * @param {string} prompt - The raw prompt returned by generateImage()
 * @param {number} seed - The resolved seed used for generation
 * @returns {string} The HTML img tag string
 */
function buildImgTag(imageUrl, prompt, seed) {
    return `<img class="comfyinject-image" src="${imageUrl}" data-prompt="${prompt.replace(/"/g, '&quot;')}" data-seed="${seed}" />`;
}

/**
 * Processes a single message by index.
 * If it contains an [[IMG: ... ]] marker, generates the image,
 * injects the <img> tag into both the DOM and the mes field,
 * saves prompt/seed to chatMetadata, and calls saveChat().
 * @param {number} index - The message index in the chat array
 */
async function processMessage(index) {
    const context = SillyTavern.getContext();
    const message = context.chat[index];
    const { updateMessageBlock } = SillyTavern.getContext();

    if (!message) return;

    // Only process bot messages
    if (message.is_user) return;

    // Skip if no marker present
    if (!hasImageMarker(message.mes)) return;

    console.log(`[ComfyInject] Processing message ${index}`);

    // Show placeholder by patching mes temporarily and catching any ST handler errors
    const originalMes = message.mes;
    message.mes = message.mes.replace(
        MARKER_REGEX,
        `<span class="comfyinject-pending">[Generating image...]</span>`
    );
    try {
        updateMessageBlock(index, message);
    } catch (e) {
        // ST's reasoning handler may crash on some messages, that's okay
    }
    message.mes = originalMes;

    let result;
    try {
        result = await processImageMarker(message.mes);
    } catch (err) {
        console.error(`[ComfyInject] Image generation failed for message ${index}:`, err);

        // Try to show an error in the DOM — messageNode may not exist for old messages
        const messageNode = document.querySelector(`[mesid="${index}"]`);
        if (messageNode) {
            const mesText = messageNode.querySelector(".mes_text");
            if (mesText) {
                mesText.innerHTML = mesText.innerHTML.replace(
                    /<span class="comfyinject-pending">.*?<\/span>/,
                    `<span class="comfyinject-error">[Image generation failed]</span>`
                );
            }
        }
        return;
    }

    if (!result) return;

    const { imageUrl, seed, prompt } = result;
    const imgTag = buildImgTag(imageUrl, prompt, seed);

    // Replace the [[IMG: ... ]] marker in the mes field permanently
    message.mes = message.mes.replace(MARKER_REGEX, imgTag);

    // Re-render the message using ST's own update function
    updateMessageBlock(index, message);

    // Save prompt and seed to chatMetadata keyed by message index
    // This is what outbound.js reads when building the token-efficient replacement
    if (!context.chatMetadata[MODULE_NAME]) {
        context.chatMetadata[MODULE_NAME] = {};
    }
    context.chatMetadata[MODULE_NAME][index] = { prompt, seed };

    // Persist everything to disk
    await context.saveMetadata();
    await context.saveChat();

    console.log(`[ComfyInject] Message ${index} saved with injected image`);
}

/**
 * Scans all existing messages in the current chat and processes
 * any that still have an unprocessed [[IMG: ... ]] marker.
 * Called on APP_READY and CHAT_CHANGED.
 */
async function scanExistingMessages() {
    const context = SillyTavern.getContext();
    if (!context.chat || context.chat.length === 0) return;

    console.log(`[ComfyInject] Scanning ${context.chat.length} existing messages`);

    for (let i = 0; i < context.chat.length; i++) {
        const message = context.chat[i];
        if (!message.is_user && hasImageMarker(message.mes)) {
            await processMessage(i);
        }
    }
}

// Tracks the last chat ID we scanned to prevent double scanning on startup
let lastScannedChatId = null;

/**
 * Registers all SillyTavern event listeners.
 * Called once from index.js on load.
 */
export function initDom() {
    const { eventSource, event_types } = SillyTavern.getContext();

    // Process new bot messages as they are rendered
    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, async (index) => {
        await processMessage(index);
    });

    // Re-scan when chat changes, but only if it's actually a different chat
    eventSource.on(event_types.CHAT_CHANGED, async () => {
        const currentChatId = SillyTavern.getContext().getCurrentChatId();
        if (currentChatId === lastScannedChatId) return;
        lastScannedChatId = currentChatId;
        await scanExistingMessages();
    });

    // Initial scan when app is ready
    eventSource.on(event_types.APP_READY, async () => {
        const currentChatId = SillyTavern.getContext().getCurrentChatId();
        if (currentChatId === lastScannedChatId) return;
        lastScannedChatId = currentChatId;
        await scanExistingMessages();
    });

    console.log("[ComfyInject] DOM listener initialized");
}