// Default settings for ComfyInject
// These are loaded into SillyTavern's extension settings panel.
// DO NOT CHANGE THESE VALUES HERE. Instead, change them in the UI.

export const MODULE_NAME = "comfyinject";

export const defaultSettings = Object.freeze({

    // --- ComfyUI Connection ---
    comfy_host: "http://127.0.0.1:8188",

    // --- Model ---
    // The filename of your checkpoint as it appears in ComfyUI's model list.
    // Example: "v1-5-pruned-emaonly.ckpt" or "dreamshaper_8.safetensors"
    checkpoint: "v1-5-pruned-emaonly-fp16.safetensors",

    // --- Workflow ---
    // The filename of the workflow JSON in the workflows folder.
    workflow: "comfyinject_default.json",

    // --- Negative Prompt ---
    negative_prompt: "worst quality, low quality, blurry, deformed, ugly, extra limbs",

    // --- Prepend Prompt ---
    // Custom tags prepended to every positive prompt before the LLM's output.
    prepend_prompt: "",

    // --- Append Prompt ---
    // Custom tags appended to every positive prompt after the LLM's output.
    append_prompt: "",

    // --- Sampler Settings ---
    steps: 24,
    cfg: 7.0,
    sampler: "euler",
    scheduler: "normal",
    denoise: 1.0,

    // --- Polling ---
    // Maximum number of 1-second polls before giving up on an image.
    max_poll_attempts: 180,

    // --- Aspect Ratio Resolutions ---
    // Width x Height in pixels for each AR token the LLM can use.
    resolutions: {
        PORTRAIT:  { width: 512,  height: 768 },
        SQUARE:    { width: 512,  height: 512 },
        LANDSCAPE: { width: 768,  height: 512 },
        CINEMA:    { width: 768,  height: 432 },
    },

    // --- Resolution Lock ---
    // When enabled, ignores the LLM's AR token and uses this resolution for everything.
    resolution_lock_enabled: false,
    resolution_lock: { width: 512, height: 768 },

    // --- Shot Lock ---
    // When enabled, ignores the LLM's SHOT token and uses this shot type for everything.
    shot_lock_enabled: false,
    shot_lock: "MEDIUM",

    // --- Seed Lock ---
    // When enabled, ignores the LLM's SEED token and uses this seed mode for everything.
    // seed_lock_mode can be "RANDOM", "LOCK", or "CUSTOM".
    seed_lock_enabled: false,
    seed_lock_mode: "RANDOM",
    seed_lock_value: 0,

    // --- Shot Tags ---
    // Danbooru-style tags prepended to the positive prompt for each SHOT token.
    // Edit these to match your model's preferred framing vocabulary.
    shot_tags: {
        CLOSE:     "close-up, face focus",
        MEDIUM:    "upper body",
        WIDE:      "full body",
        DUTCH:     "dutch angle",
        OVERHEAD:  "from above, bird's eye view",
        LOWANGLE:  "from below",
        HIGHANGLE: "from above",
        PROFILE:   "profile, from side",
        BACKVIEW:  "from behind",
        POV:       "pov",
    },
});