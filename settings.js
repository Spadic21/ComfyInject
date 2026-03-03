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
    checkpoint: "v1-5-pruned-emaonly.safetensors",

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

});
