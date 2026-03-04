// Tracks the last successfully used seed so LOCK can reference it.
// If no seed has been used yet and LOCK is requested, we fall back to RANDOM.

let lastSeed = null;

/**
 * Resolves a seed token into a concrete integer.
 * - RANDOM: generates a new random seed
 * - LOCK: returns the last used seed, or a random one if none exists yet
 * - integer: passes through as-is
 * @param {string|number} seed - The seed value from the parsed marker
 * @returns {number} A resolved numeric seed
 */
export function resolveSeed(seed) {
    if (seed === "RANDOM" || seed === undefined || seed === null) {
        return generateRandomSeed();
    }

    if (seed === "LOCK") {
        if (lastSeed === null) {
            console.log("[ComfyInject] LOCK requested but no previous seed exists, using RANDOM");
            return generateRandomSeed();
        }
        return lastSeed;
    }

    // Integer passed directly — parse it just in case it came in as a string
    const parsed = parseInt(seed, 10);
    if (isNaN(parsed)) {
        console.warn(`[ComfyInject] Unrecognized seed value "${seed}", falling back to RANDOM`);
        return generateRandomSeed();
    }

    return parsed;
}

/**
 * Saves the seed that was actually used for a generation.
 * Should be called after a successful generateImage() so LOCK works next time.
 * @param {number} seed - The seed that was used
 */
export function saveLastSeed(seed) {
    lastSeed = seed;
}

/**
 * Returns the last used seed, or null if none exists yet.
 * @returns {number|null}
 */
export function getLastSeed() {
    return lastSeed;
}

/**
 * Generates a random integer seed in ComfyUI's expected range.
 * @returns {number}
 */
function generateRandomSeed() {
    // ComfyUI accepts seeds up to 2^32 - 1
    return Math.floor(Math.random() * 4294967295);
}