// Default settings for ComfyInject
// These are loaded into SillyTavern's extension settings panel.
// Users can change these without editing the workflow JSON directly.

export const MODULE_NAME = "comfyinject";

export const defaultSettings = Object.freeze({

    // --- ComfyUI Connection ---
    comfy_host: "http://127.0.0.1:8188",

    // --- Model ---
    // The filename of your checkpoint as it appears in ComfyUI's model list.
    // Example: "v1-5-pruned-emaonly.ckpt" or "dreamshaper_8.safetensors"
    checkpoint: "waiIllustriousSDXL_v160.safetensors",

    // --- Negative Prompt ---
    negative_prompt: "worst quality, low quality, blurry, deformed, ugly, extra limbs",

    // --- Sampler Settings ---
    steps: 24,
    cfg: 7.0,
    sampler: "euler",
    scheduler: "normal",
    denoise: 1.0,

    // --- Aspect Ratio Resolutions ---
    // Width x Height in pixels for each AR token the LLM can use.
    resolutions: {
        PORTRAIT:  { width: 512,  height: 768 },
        SQUARE:    { width: 512,  height: 512 },
        LANDSCAPE: { width: 768,  height: 512 },
        CINEMA:    { width: 768,  height: 432 },
    },

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
