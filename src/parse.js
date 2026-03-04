import { generateImage } from "./comfy.js";
import { resolveSeed, saveLastSeed } from "./state.js";

// Valid values for AR and SHOT tokens
const VALID_AR   = new Set(["PORTRAIT", "SQUARE", "LANDSCAPE", "CINEMA"]);
const VALID_SHOT = new Set(["CLOSE", "MEDIUM", "WIDE", "DUTCH", "OVERHEAD", "LOWANGLE", "HIGHANGLE", "PROFILE", "BACKVIEW", "POV"]);

// Fallback defaults if the bot gives us something invalid
const DEFAULT_AR   = "PORTRAIT";
const DEFAULT_SHOT = "WIDE";

// Regex to match [[IMG: ... ]] — captures everything inside
export const MARKER_REGEX = /\[\[IMG:\s*(.+?)\s*\]\]/s;

/**
 * Checks whether a message string contains an [[IMG: ... ]] marker.
 * @param {string} text - Raw message text
 * @returns {boolean}
 */
export function hasImageMarker(text) {
    return MARKER_REGEX.test(text);
}

/**
 * Parses the [[IMG: ... ]] marker from a message, resolves all values,
 * triggers image generation, and returns the result.
 *
 * Falls back to defaults if AR or SHOT are invalid rather than aborting,
 * so a slightly malformed marker still produces an image.
 *
 * @param {string} text - Raw message text containing the marker
 * @returns {Promise<{imageUrl: string, seed: number, prompt: string} | null>}
 *          Returns null if no marker is found or parsing fails fatally.
 */
export async function processImageMarker(text) {
    const match = text.match(MARKER_REGEX);

    if (!match) {
        console.warn("[ComfyInject] processImageMarker called but no marker found");
        return null;
    }

    // Split the inner content by | into exactly 4 segments
    const segments = match[1].split("|").map(s => s.trim());

    if (segments.length !== 4) {
        console.warn(`[ComfyInject] Marker has ${segments.length} segment(s), expected 4. Aborting.`);
        return null;
    }

    const [rawPrompt, rawAR, rawShot, rawSeed] = segments;

    // Validate prompt — if empty we really can't do anything useful
    if (!rawPrompt) {
        console.warn("[ComfyInject] Marker has an empty prompt. Aborting.");
        return null;
    }

    // Validate AR — fall back to default if invalid
    let ar = rawAR.toUpperCase();
    if (!VALID_AR.has(ar)) {
        console.warn(`[ComfyInject] Invalid AR "${rawAR}", falling back to ${DEFAULT_AR}`);
        ar = DEFAULT_AR;
    }

    // Validate SHOT — fall back to default if invalid
    let shot = rawShot.toUpperCase();
    if (!VALID_SHOT.has(shot)) {
        console.warn(`[ComfyInject] Invalid SHOT "${rawShot}", falling back to ${DEFAULT_SHOT}`);
        shot = DEFAULT_SHOT;
    }

    // Resolve seed — handles RANDOM, LOCK, and integer strings
    const seed = resolveSeed(rawSeed.toUpperCase());

    console.log(`[ComfyInject] Parsed marker — prompt: "${rawPrompt}" | AR: ${ar} | SHOT: ${shot} | seed: ${seed}`);

    // Generate the image via ComfyUI
    const result = await generateImage({
        prompt: rawPrompt,
        ar,
        shot,
        seed,
    });

    // Save the seed that was actually used so LOCK works on the next message
    saveLastSeed(result.seed);

    return result;
}