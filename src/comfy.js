import { MODULE_NAME } from "../settings.js";
import { resolveSeed } from "./state.js";

const EXTENSION_FOLDER = `scripts/extensions/third-party/ComfyInject`;

// How long to wait between polls (ms)
const POLL_INTERVAL_MS = 1000;

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
 * Uses the filename from settings so users can swap workflows.
 * @returns {Promise<object>} The parsed workflow object
 */
async function loadWorkflow() {
    const settings = getSettings();
    const filename = settings.workflow || "comfyinject_default.json";
    const response = await fetch(`/${EXTENSION_FOLDER}/workflows/${filename}`);
    if (!response.ok) {
        throw new Error(`[ComfyInject] Failed to load workflow "${filename}": ${response.status}`);
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
 * @param {number} maxAttempts - Maximum number of poll attempts before giving up
 * @returns {Promise<{filename: string, subfolder: string}>} The filename and subfolder of the generated image
 */
async function pollForResult(promptId, host, maxAttempts) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
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
                return { filename: images[0].filename, subfolder: images[0].subfolder ?? "" };
            }
        }
    }

    throw new Error(`[ComfyInject] Timed out waiting for image after ${maxAttempts} attempts`);
}

/**
 * Builds the full /view URL for a generated image.
 * @param {string} filename - The image filename from pollForResult
 * @param {string} host - ComfyUI host URL
 * @returns {string} The full image URL
 */
function buildImageUrl(filename, subfolder, host) {
    const params = new URLSearchParams({ filename, type: "output" });
    if (subfolder) params.set("subfolder", subfolder);
    return `${host}/view?${params.toString()}`;
}

/**
 * Main entry point. Takes parsed marker data and returns a usable image URL.
 * @param {object} params
 * @param {string} params.prompt - The positive prompt text
 * @param {string} params.ar - Aspect ratio token (PORTRAIT, SQUARE, etc.)
 * @param {string} params.shot - Shot type token (CLOSE, MEDIUM, etc.)
 * @param {number} params.seed - The resolved numeric seed (LOCK/RANDOM already resolved by state.js)
 * @param {number} params.messageIndex - The index of the message being processed (needed for LOCK seed resolution)
 * @param {boolean} [params.bypassSeedLock] - If true, skip the seed lock and use the provided seed directly (used by retry)
 * @returns {Promise<{imageUrl: string, seed: number, prompt: string, promptId: string, filename: string, effectiveAr: string, effectiveShot: string, resolution: {width: number, height: number}, shotTags: string}>}
 */
export async function generateImage({ prompt, ar, shot, seed, messageIndex, bypassSeedLock = false }) {
    const settings = getSettings();

    // Resolve resolution — use locked resolution if enabled, otherwise use the AR token
    const resolution = settings.resolution_lock_enabled
        ? settings.resolution_lock
        : settings.resolutions[ar];

    if (!resolution) {
        throw new Error(`[ComfyInject] Unknown AR token: ${ar}`);
    }

    // Prepend shot tags to the positive prompt — use locked shot if enabled, otherwise use the LLM's token
    const effectiveShot = settings.shot_lock_enabled ? settings.shot_lock : shot;
    const shotTag = settings.shot_tags?.[effectiveShot] ?? "";
    const prepend = settings.prepend_prompt?.trim() ?? "";
    const append = settings.append_prompt?.trim() ?? "";

    // Build the final positive prompt: prepend prompt, shot tags, LLM prompt, append prompt
    const parts = [prepend, shotTag, prompt, append].filter(Boolean);
    const positivePrompt = parts.join(", ");

    // Resolve seed — use locked seed mode if enabled (unless bypassed by retry), otherwise use the provided seed
    const effectiveSeed = (settings.seed_lock_enabled && !bypassSeedLock)
        ? resolveSeed(settings.seed_lock_mode === "CUSTOM" ? settings.seed_lock_value : settings.seed_lock_mode, messageIndex)
        : seed;

    // Load and fill the workflow
    const workflow = await loadWorkflow();
    const filled = fillWorkflow(workflow, {
        CHECKPOINT:       settings.checkpoint,
        POSITIVE_PROMPT:  positivePrompt,
        NEGATIVE_PROMPT:  settings.negative_prompt,
        WIDTH:            resolution.width,
        HEIGHT:           resolution.height,
        SEED:             effectiveSeed,
        STEPS:            settings.steps,
        CFG:              settings.cfg,
        SAMPLER:          settings.sampler,
        SCHEDULER:        settings.scheduler,
        DENOISE:          settings.denoise,
    });

    // Submit to ComfyUI and wait for the result
    const promptId = await submitPrompt(filled, settings.comfy_host);
    console.log(`[ComfyInject] Job submitted, prompt_id: ${promptId}`);

    const maxAttempts = settings.max_poll_attempts ?? 180;
    const { filename, subfolder } = await pollForResult(promptId, settings.comfy_host, maxAttempts);
    console.log(`[ComfyInject] Image ready: ${filename}`);

    const imageUrl = buildImageUrl(filename, subfolder, settings.comfy_host);

    return {
        imageUrl,
        seed: effectiveSeed,
        prompt,
        promptId,
        filename,
        // Effective values — what was actually sent to ComfyUI
        effectiveAr: settings.resolution_lock_enabled ? "LOCKED" : ar,
        effectiveShot: settings.shot_lock_enabled ? "LOCKED" : shot,
        resolution: { width: resolution.width, height: resolution.height },
        shotTags: shotTag,
    };
}