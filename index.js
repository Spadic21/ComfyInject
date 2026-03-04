import { initDom } from "./src/dom.js";
import { MODULE_NAME, defaultSettings } from "./settings.js";

// Import outbound so comfyInjectInterceptor gets registered on globalThis
import "./src/outbound.js";

/**
 * Initializes ComfyInject settings.
 * Merges defaults with any existing saved settings so new
 * keys are always present after an update.
 */
function initSettings() {
    const { extensionSettings, saveSettingsDebounced } = SillyTavern.getContext();

    if (!extensionSettings[MODULE_NAME]) {
        extensionSettings[MODULE_NAME] = {};
    }

    // Merge defaults into existing settings so new keys are always present
    const saved = extensionSettings[MODULE_NAME];
    for (const key of Object.keys(defaultSettings)) {
        if (!(key in saved)) {
            saved[key] = structuredClone(defaultSettings[key]);
        }
    }

    saveSettingsDebounced();
}

// Entry point
(async () => {
    console.log("[ComfyInject] Loading...");

    initSettings();
    initDom();

    console.log("[ComfyInject] Ready!");
})();