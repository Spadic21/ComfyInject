import { MODULE_NAME, defaultSettings } from "../settings.js";

const EXTENSION_FOLDER = `scripts/extensions/third-party/ComfyInject`;

/**
 * Gets the current live settings from ST.
 * @returns {object}
 */
function getSettings() {
    const { extensionSettings } = SillyTavern.getContext();
    return extensionSettings[MODULE_NAME];
}

/**
 * Saves the current settings to ST.
 */
function saveSettings() {
    const { saveSettingsDebounced } = SillyTavern.getContext();
    saveSettingsDebounced();
}

/**
 * Populates all input fields from current settings.
 */
function populateUI() {
    const settings = getSettings();

    $("#comfyinject_host").val(settings.comfy_host);
    $("#comfyinject_checkpoint").val(settings.checkpoint);
    $("#comfyinject_negative_prompt").val(settings.negative_prompt);
    $("#comfyinject_steps").val(settings.steps);
    $("#comfyinject_cfg").val(settings.cfg);
    $("#comfyinject_sampler").val(settings.sampler);
    $("#comfyinject_scheduler").val(settings.scheduler);
    $("#comfyinject_denoise").val(settings.denoise);

    // Populate resolutions
    const resContainer = $("#comfyinject_resolutions");
    resContainer.empty();
    for (const [token, res] of Object.entries(settings.resolutions)) {
        resContainer.append(`
            <div class="flex-container flexGap5 alignItemsCenter" style="margin-bottom: 4px;">
                <label style="width: 80px;">${token}</label>
                <input
                    type="number"
                    class="text_pole comfyinject-res-width"
                    data-token="${token}"
                    value="${res.width}"
                    min="64"
                    max="2048"
                    step="64"
                    style="width: 70px;"
                />
                <span>×</span>
                <input
                    type="number"
                    class="text_pole comfyinject-res-height"
                    data-token="${token}"
                    value="${res.height}"
                    min="64"
                    max="2048"
                    step="64"
                    style="width: 70px;"
                />
            </div>
        `);
    }

    // Populate shot tags
    const shotContainer = $("#comfyinject_shot_tags");
    shotContainer.empty();
    for (const [token, tags] of Object.entries(settings.shot_tags)) {
        shotContainer.append(`
            <div class="flex-container flexGap5 alignItemsCenter" style="margin-bottom: 4px;">
                <label style="width: 80px;">${token}</label>
                <input
                    type="text"
                    class="text_pole comfyinject-shot-tag"
                    data-token="${token}"
                    value="${tags}"
                />
            </div>
        `);
    }
}

/**
 * Wires up all input event listeners.
 */
function wireEvents() {
    // Host
    $("#comfyinject_host").on("input", function () {
        getSettings().comfy_host = $(this).val();
        saveSettings();
    });

    // Checkpoint
    $("#comfyinject_checkpoint").on("input", function () {
        getSettings().checkpoint = $(this).val();
        saveSettings();
    });

    // Negative prompt
    $("#comfyinject_negative_prompt").on("input", function () {
        getSettings().negative_prompt = $(this).val();
        saveSettings();
    });

    // Steps
    $("#comfyinject_steps").on("input", function () {
        getSettings().steps = parseInt($(this).val(), 10);
        saveSettings();
    });

    // CFG
    $("#comfyinject_cfg").on("input", function () {
        getSettings().cfg = parseFloat($(this).val());
        saveSettings();
    });

    // Sampler
    $("#comfyinject_sampler").on("input", function () {
        getSettings().sampler = $(this).val();
        saveSettings();
    });

    // Scheduler
    $("#comfyinject_scheduler").on("input", function () {
        getSettings().scheduler = $(this).val();
        saveSettings();
    });

    // Denoise
    $("#comfyinject_denoise").on("input", function () {
        getSettings().denoise = parseFloat($(this).val());
        saveSettings();
    });

    // Resolutions — width
    $("#comfyinject_resolutions").on("input", ".comfyinject-res-width", function () {
        const token = $(this).data("token");
        getSettings().resolutions[token].width = parseInt($(this).val(), 10);
        saveSettings();
    });

    // Resolutions — height
    $("#comfyinject_resolutions").on("input", ".comfyinject-res-height", function () {
        const token = $(this).data("token");
        getSettings().resolutions[token].height = parseInt($(this).val(), 10);
        saveSettings();
    });

    // Shot tags
    $("#comfyinject_shot_tags").on("input", ".comfyinject-shot-tag", function () {
        const token = $(this).data("token");
        getSettings().shot_tags[token] = $(this).val();
        saveSettings();
    });

    // Advanced settings toggle
    $("#comfyinject_advanced_toggle").on("click", function () {
        $("#comfyinject_advanced_block").toggle();
    });

    // Resolutions toggle
    $("#comfyinject_resolutions_toggle").on("click", function () {
        $("#comfyinject_resolutions_block").toggle();
    });

    // Shot tags toggle
    $("#comfyinject_shot_tags_toggle").on("click", function () {
        $("#comfyinject_shot_tags_block").toggle();
    });

    // Reset button — resets everything except comfy_host and checkpoint
    $("#comfyinject_reset").on("click", function () {
        const settings = getSettings();
        const { comfy_host, checkpoint } = settings;

        // Reset to defaults
        Object.assign(settings, structuredClone(defaultSettings));

        // Restore connection settings
        settings.comfy_host = comfy_host;
        settings.checkpoint = checkpoint;

        saveSettings();
        populateUI();

        toastr.success("Advanced settings reset to defaults!", "ComfyInject");
    });
}

/**
 * Loads the settings HTML and initializes the UI.
 * Called once from index.js on load.
 */
export async function initUI() {
    const settingsHtml = await $.get(`/${EXTENSION_FOLDER}/settings.html`);
    $("#extensions_settings").append(settingsHtml);
    populateUI();
    wireEvents();
}