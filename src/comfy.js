import { MODULE_NAME } from "../settings.js";

const EXTENSION_FOLDER = `scripts/extensions/third-party/ComfyInject`;

// How long to wait between polls (ms) and how many times to try before giving up
const POLL_INTERVAL_MS = 1500;
const POLL_MAX_ATTEMPTS = 60; // 90 seconds max

/**
 * Gets the current ComfyInject settings from SillyTavern's extension settings.
 * @returns {object} The current settings object
 */
function getSettings() {
    const { extensionSettings } = SillyTavern.getContext();
    return extensionSettings[MODULE_NAME];
}

/**
 * Loads the workflow JSON from the workflows folder.
 * @returns {Promise<object>} The parsed workflow object
 */
async function loadWorkflow() {
    const response = await fetch(`/${EXTENSION_FOLDER}/workflows/comfyinject_default.json`);
    if (!response.ok) {
        throw new Error(`[ComfyInject] Failed to load workflow JSON: ${response.status}`);
    }
    return await response.json();
}

/**
 * Fills all {{PLACEHOLDER}} tokens in the workflow with real values.
 * Operates on a deep copy so the original is never mutated.
 * @param {object} workflow - The raw workflow object
 * @param {object} values - Key/value pairs to substitute
 * @returns {object} The filled workflow object
 */
function fillWorkflow(workflow, values) {
    let workflowStr = JSON.stringify(workflow);

    for (const [key, value] of Object.entries(values)) {
        const placeholder = `"{{${key}}}"`;
        const replacement = JSON.stringify(value);
        while (workflowStr.includes(placeholder)) {
            workflowStr = workflowStr.replace(placeholder, replacement);
        }
    }

    return JSON.parse(workflowStr);
}

/**
 * POSTs the filled workflow to ComfyUI's /prompt endpoint.
 * @param {object} workflow - The filled workflow object
 * @param {string} host - ComfyUI host URL
 * @returns {Promise<string>} The prompt_id returned by ComfyUI
 */
async function submitPrompt(workflow, host) {
    const response = await fetch(`${host}/prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: workflow }),
    });

    if (!response.ok) {
        throw new Error(`[ComfyInject] Failed to submit prompt: ${response.status}`);
    }

    const data = await response.json();

    if (!data.prompt_id) {
        throw new Error(`[ComfyInject] ComfyUI response missing prompt_id`);
    }

    return data.prompt_id;
}

/**
 * Polls /history/{prompt_id} until the image is ready or we time out.
 * @param {string} promptId - The prompt_id from submitPrompt
 * @param {string} host - ComfyUI host URL
 * @returns {Promise<string>} The filename of the generated image
 */
async function pollForResult(promptId, host) {
    for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));

        const response = await fetch(`${host}/history/${promptId}`);
        if (!response.ok) continue;

        const history = await response.json();
        const result = history[promptId];

        if (!result) continue;

        // Walk the outputs to find a SaveImage node result
        const outputs = result.outputs;
        for (const nodeId of Object.keys(outputs)) {
            const images = outputs[nodeId]?.images;
            if (images && images.length > 0) {
                return images[0].filename;
            }
        }
    }

    throw new Error(`[ComfyInject] Timed out waiting for image after ${POLL_MAX_ATTEMPTS} attempts`);
}

/**
 * Builds the full /view URL for a generated image.
 * @param {string} filename - The image filename from pollForResult
 * @param {string} host - ComfyUI host URL
 * @returns {string} The full image URL
 */
function buildImageUrl(filename, host) {
    return `${host}/view?filename=${encodeURIComponent(filename)}&type=output`;
}

/**
 * Main entry point. Takes parsed marker data and returns a usable image URL.
 * @param {object} params
 * @param {string} params.prompt - The positive prompt text
 * @param {string} params.ar - Aspect ratio token (PORTRAIT, SQUARE, etc.)
 * @param {string} params.shot - Shot type token (CLOSE, MEDIUM, etc.)
 * @param {number} params.seed - The resolved numeric seed (LOCK/RANDOM already resolved by state.js)
 * @returns {Promise<{imageUrl: string, seed: number}>}
 */
export async function generateImage({ prompt, ar, shot, seed }) {
    const settings = getSettings();

    // Resolve resolution from AR token
    const resolution = settings.resolutions[ar];
    if (!resolution) {
        throw new Error(`[ComfyInject] Unknown AR token: ${ar}`);
    }

    // Prepend shot tags to the positive prompt
    const shotTag = settings.shot_tags?.[shot] ?? "";
    const positivePrompt = shotTag ? `${shotTag}, ${prompt}` : prompt;

    // Load and fill the workflow
    const workflow = await loadWorkflow();
    const filled = fillWorkflow(workflow, {
        CHECKPOINT:       settings.checkpoint,
        POSITIVE_PROMPT:  positivePrompt,
        NEGATIVE_PROMPT:  settings.negative_prompt,
        WIDTH:            resolution.width,
        HEIGHT:           resolution.height,
        SEED:             seed,
        STEPS:            settings.steps,
        CFG:              settings.cfg,
        SAMPLER:          settings.sampler,
        SCHEDULER:        settings.scheduler,
        DENOISE:          settings.denoise,
    });

    // Submit to ComfyUI and wait for the result
    const promptId = await submitPrompt(filled, settings.comfy_host);
    console.log(`[ComfyInject] Job submitted, prompt_id: ${promptId}`);

    const filename = await pollForResult(promptId, settings.comfy_host);
    console.log(`[ComfyInject] Image ready: ${filename}`);

    const imageUrl = buildImageUrl(filename, settings.comfy_host);

    return { imageUrl, seed, prompt }; // Just raw 'prompt' so 'outbound.js' can construct the token-efficient replacement like: [[IMG: danbooru tags the bot wrote | SEED_NUMBER ]]
}