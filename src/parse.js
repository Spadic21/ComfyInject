import { generateImage } from "./comfy.js";
import { resolveSeed, saveLastSeed } from "./state.js";
import { MODULE_NAME } from "../settings.js";

// Valid values for AR and SHOT tokens
const VALID_AR   = new Set(["PORTRAIT", "SQUARE", "LANDSCAPE", "CINEMA"]);
const VALID_SHOT = new Set(["CLOSE", "MEDIUM", "WIDE", "DUTCH", "OVERHEAD", "LOWANGLE", "HIGHANGLE", "PROFILE", "BACKVIEW", "POV"]);
const AR_TOKENS = [...VALID_AR];
const SHOT_TOKENS = [...VALID_SHOT];

// Hard fallback defaults if settings are unavailable
const DEFAULT_AR   = "PORTRAIT";
const DEFAULT_SHOT = "WIDE";
const DEFAULT_SEED = "RANDOM";

// Prevent toast spam in messages with many repaired markers
let lastRepairToastAt = 0;
const REPAIR_TOAST_COOLDOWN_MS = 3000;

// Regex to match [[IMG: ... ]] — captures everything inside (non-global, for single match)
export const MARKER_REGEX = /\[\[IMG:\s*(.+?)\s*\]\]/s;

// Global version for finding all markers in a message
const MARKER_REGEX_GLOBAL = /\[\[IMG:\s*(.+?)\s*\]\]/gs;

/**
 * Checks whether a message string contains an [[IMG: ... ]] marker.
 * @param {string} text - Raw message text
 * @returns {boolean}
 */
export function hasImageMarker(text) {
    return MARKER_REGEX.test(text);
}

/**
 * Parses the inner content of a single [[IMG: ... ]] marker into its components.
 * Does NOT trigger generation — just validates and resolves values.
 * @param {string} innerContent - The text between [[IMG: and ]]
 * @param {number} messageIndex - The message index (needed for LOCK seed resolution)
 * @returns {{ status: "ok", prompt: string, ar: string, shot: string, seed: number, repairMeta: {defaulted: string[], duplicatesIgnored: string[]} } | { status: "parse_error", reason: string, repairMeta: {defaulted: string[], duplicatesIgnored: string[]} }}
 */
function parseMarkerContent(innerContent, messageIndex) {
    const segments = innerContent
        .split("|")
        .map(s => s.trim())
        .filter(Boolean);

    const repairMeta = {
        defaulted: [],
        duplicatesIgnored: [],
    };

    const defaults = getMarkerDefaults();

    const promptParts = [];
    let ar = null;
    let shot = null;
    let seedToken = null;

    for (const segment of segments) {
        const upper = segment.toUpperCase();
        const seedKind = classifySeed(upper);

        if (VALID_AR.has(upper)) {
            if (ar === null) {
                ar = upper;
            } else {
                repairMeta.duplicatesIgnored.push(`AR=${upper}`);
                console.warn(`[ComfyInject] Duplicate AR "${upper}" ignored.`);
            }
            continue;
        }

        if (VALID_SHOT.has(upper)) {
            if (shot === null) {
                shot = upper;
            } else {
                repairMeta.duplicatesIgnored.push(`SHOT=${upper}`);
                console.warn(`[ComfyInject] Duplicate SHOT "${upper}" ignored.`);
            }
            continue;
        }

        if (seedKind) {
            if (seedToken === null) {
                seedToken = upper;
            } else {
                repairMeta.duplicatesIgnored.push(`SEED=${upper}`);
                console.warn(`[ComfyInject] Duplicate SEED "${upper}" ignored.`);
            }
            continue;
        }

        promptParts.push(segment);
    }

    const prompt = promptParts.join(", ").trim();

    // Empty prompt is the only parser hard-fail.
    if (!prompt) {
        console.warn("[ComfyInject] Marker invalid: empty prompt.");
        return {
            status: "parse_error",
            reason: "empty_prompt",
            repairMeta,
        };
    }

    if (ar === null) {
        ar = defaults.ar;
        repairMeta.defaulted.push(`AR=${ar}`);
    }

    if (shot === null) {
        shot = defaults.shot;
        repairMeta.defaulted.push(`SHOT=${shot}`);
    }

    if (seedToken === null) {
        seedToken = defaults.seed;
        repairMeta.defaulted.push(`SEED=${seedToken}`);
    }

    const seed = resolveSeed(seedToken, messageIndex);

    return {
        status: "ok",
        prompt,
        ar,
        shot,
        seed,
        repairMeta,
    };
}

function classifySeed(value) {
    if (value === "RANDOM" || value === "LOCK") return value;
    if (/^\d+$/.test(value)) return "INTEGER";
    return null;
}

function chooseRandom(list) {
    return list[Math.floor(Math.random() * list.length)];
}

function getMarkerDefaults() {
    const settings = getSettings();

    const rawAr = String(settings.default_ar ?? DEFAULT_AR).toUpperCase();
    const rawShot = String(settings.default_shot ?? DEFAULT_SHOT).toUpperCase();
    const rawSeed = String(settings.default_seed ?? DEFAULT_SEED).toUpperCase();

    const ar = rawAr === "RANDOM"
        ? chooseRandom(AR_TOKENS)
        : (VALID_AR.has(rawAr) ? rawAr : DEFAULT_AR);

    const shot = rawShot === "RANDOM"
        ? chooseRandom(SHOT_TOKENS)
        : (VALID_SHOT.has(rawShot) ? rawShot : DEFAULT_SHOT);

    const seed = classifySeed(rawSeed) ? rawSeed : DEFAULT_SEED;

    return { ar, shot, seed };
}

function getSettings() {
    const context = globalThis.SillyTavern?.getContext?.();
    const settings = context?.extensionSettings?.[MODULE_NAME] ?? {};
    return settings;
}

function maybeShowRepairToast(markerIndex, repairMeta) {
    if (!repairMeta.defaulted.length) return;

    const now = Date.now();
    if (now - lastRepairToastAt < REPAIR_TOAST_COOLDOWN_MS) return;
    lastRepairToastAt = now;

    const msg = `Repaired marker #${markerIndex}: defaulted ${repairMeta.defaulted.join(", ")}`;
    if (globalThis.toastr?.warning) {
        globalThis.toastr.warning(msg, "ComfyInject");
    }
}

/**
 * Finds ALL [[IMG: ... ]] markers in a message, processes them sequentially,
 * and returns an array of results.
 *
 * @param {string} text - Raw message text potentially containing multiple markers
 * @param {number} messageIndex - The index of the message being processed
 * @returns {Promise<Array<{status: "ok", imageUrl: string, seed: number, prompt: string, ar: string, shot: string} | {status: "parse_error", reason: string} | {status: "generation_error"}>>}
 */
export async function processAllImageMarkers(text, messageIndex) {
    const matches = [...text.matchAll(MARKER_REGEX_GLOBAL)];

    if (matches.length === 0) {
        console.warn("[ComfyInject] processAllImageMarkers called but no markers found");
        return [];
    }

    const results = [];

    for (let markerIdx = 0; markerIdx < matches.length; markerIdx++) {
        const match = matches[markerIdx];
        const parsed = parseMarkerContent(match[1], messageIndex);
        const markerNumber = markerIdx + 1;

        if (!parsed || parsed.status === "parse_error") {
            results.push({
                status: "parse_error",
                reason: parsed?.reason ?? "unknown",
            });
            continue;
        }

        const { prompt, ar, shot, seed, repairMeta } = parsed;

        if (repairMeta.defaulted.length || repairMeta.duplicatesIgnored.length) {
            const details = [];
            if (repairMeta.defaulted.length) details.push(`defaulted=[${repairMeta.defaulted.join(", ")}]`);
            if (repairMeta.duplicatesIgnored.length) details.push(`duplicates_ignored=[${repairMeta.duplicatesIgnored.join(", ")}]`);
            console.warn(`[ComfyInject] Marker ${markerNumber} repaired: ${details.join(" ")} -> (${ar}, ${shot}, ${seed})`);
            maybeShowRepairToast(markerNumber, repairMeta);
        }

        console.log(`[ComfyInject] Parsed marker ${markerNumber}/${matches.length} - prompt: "${prompt}" | AR: ${ar} | SHOT: ${shot} | seed: ${seed}`);

        try {
            const result = await generateImage({
                prompt,
                ar,
                shot,
                seed,
                messageIndex,
            });

            // Save the seed that was actually used so LOCK works
            saveLastSeed(result.seed);

            results.push({ status: "ok", ...result, ar, shot });
        } catch (err) {
            console.error(`[ComfyInject] Image generation failed for marker ${markerNumber}:`, err);
            results.push({ status: "generation_error" });
        }
    }

    return results;
}