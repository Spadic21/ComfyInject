import { MODULE_NAME, defaultSettings } from "../settings.js";
import { openGallery } from "./gallery.js";

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
 * Fetches the list of available checkpoints from ComfyUI.
 * @returns {Promise<string[]>} Array of checkpoint filenames, or empty array on failure
 */
async function fetchCheckpoints() {
    const settings = getSettings();
    try {
        const response = await fetch(`${settings.comfy_host}/object_info/CheckpointLoaderSimple`);
        if (!response.ok) return [];
        const data = await response.json();
        return data?.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0] ?? [];
    } catch {
        return [];
    }
}

/**
 * Populates the checkpoint <select> from ComfyUI API.
 * Falls back to a text input if ComfyUI is unreachable.
 */
async function populateCheckpoints() {
    const select = $("#comfyinject_checkpoint");
    const current = getSettings().checkpoint;
    const checkpoints = await fetchCheckpoints();

    if (checkpoints.length > 0) {
        select.empty();
        for (const name of checkpoints) {
            select.append(`<option value="${name}" ${name === current ? "selected" : ""}>${name}</option>`);
        }
        if (!checkpoints.includes(current) && current) {
            select.append(`<option value="${current}" selected>${current}</option>`);
        }
    } else {
        // Fallback: show current value as editable text
        select.empty();
        select.append(`<option value="${current || ''}" selected>${current || '-- ComfyUI unreachable --'}</option>`);
    }
}

/**
 * Fetches the workflow index and populates the <select>.
 */
async function populateWorkflows() {
    const select = $("#comfyinject_workflow");
    const current = getSettings().workflow;

    try {
        const response = await fetch(`/${EXTENSION_FOLDER}/workflows/index.json`);
        const workflows = await response.json();
        select.empty();
        for (const name of workflows) {
            select.append(`<option value="${name}" ${name === current ? "selected" : ""}>${name}</option>`);
        }
        if (!workflows.includes(current) && current) {
            select.append(`<option value="${current}" selected>${current}</option>`);
        }
    } catch {
        select.empty();
        select.append(`<option value="${current || ''}" selected>${current || '-- No workflows found --'}</option>`);
    }
}

/**
 * Updates the resolution lock inputs visibility and the per-token
 * resolution inputs opacity based on the lock state.
 * @param {boolean} locked - Whether resolution lock is enabled
 */
function updateResolutionLockUI(locked) {
    $("#comfyinject_resolution_lock_inputs").toggle(locked);
    // Dim the per-token inputs when locked so it's obvious they're being ignored
    $("#comfyinject_resolutions").css("opacity", locked ? 0.4 : 1.0);
    $("#comfyinject_resolutions").css("pointer-events", locked ? "none" : "auto");
}

/**
 * Updates the shot lock inputs visibility and the per-token
 * shot tag inputs opacity based on the lock state.
 * @param {boolean} locked - Whether shot lock is enabled
 */
function updateShotLockUI(locked) {
    $("#comfyinject_shot_lock_inputs").toggle(locked);
    // Dim the per-token inputs when locked so it's obvious they're being ignored
    $("#comfyinject_shot_tags").css("opacity", locked ? 0.4 : 1.0);
    $("#comfyinject_shot_tags").css("pointer-events", locked ? "none" : "auto");
}

/**
 * Updates the seed lock inputs visibility and the custom seed input
 * visibility based on the lock state and selected mode.
 * @param {boolean} locked - Whether seed lock is enabled
 */
function updateSeedLockUI(locked) {
    $("#comfyinject_seed_lock_inputs").toggle(locked);
    // Show the custom seed input only when mode is CUSTOM
    const mode = $("#comfyinject_seed_lock_mode").val();
    $("#comfyinject_seed_lock_custom_input").toggle(locked && mode === "CUSTOM");
}


/**
 * Populates all input fields from current settings.
 */
function populateUI() {
    const settings = getSettings();

    $("#comfyinject_host").val(settings.comfy_host);
    $("#comfyinject_checkpoint").val(settings.checkpoint);
    $("#comfyinject_workflow").val(settings.workflow);
    $("#comfyinject_negative_prompt").val(settings.negative_prompt);
    $("#comfyinject_prepend_prompt").val(settings.prepend_prompt);
    $("#comfyinject_append_prompt").val(settings.append_prompt);
    $("#comfyinject_steps").val(settings.steps);
    $("#comfyinject_cfg").val(settings.cfg);
    $("#comfyinject_sampler").val(settings.sampler);
    $("#comfyinject_scheduler").val(settings.scheduler);
    $("#comfyinject_denoise").val(settings.denoise);
    $("#comfyinject_max_poll_attempts").val(settings.max_poll_attempts);

    // Resolution lock
    $("#comfyinject_resolution_lock_enabled").prop("checked", settings.resolution_lock_enabled);
    $("#comfyinject_resolution_lock_width").val(settings.resolution_lock.width);
    $("#comfyinject_resolution_lock_height").val(settings.resolution_lock.height);
    updateResolutionLockUI(settings.resolution_lock_enabled);

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
                <span>&times;</span>
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

    // Shot lock
    $("#comfyinject_shot_lock_enabled").prop("checked", settings.shot_lock_enabled);
    const shotSelect = $("#comfyinject_shot_lock_value");
    shotSelect.empty();
    for (const token of Object.keys(settings.shot_tags)) {
        shotSelect.append(`<option value="${token}" ${token === settings.shot_lock ? "selected" : ""}>${token}</option>`);
    }
    updateShotLockUI(settings.shot_lock_enabled);

    // Seed lock
    $("#comfyinject_seed_lock_enabled").prop("checked", settings.seed_lock_enabled);
    $("#comfyinject_seed_lock_mode").val(settings.seed_lock_mode);
    $("#comfyinject_seed_lock_value").val(settings.seed_lock_value);
    updateSeedLockUI(settings.seed_lock_enabled);

    // Marker repair notifications
    $("#comfyinject_repair_toast_mode").val(settings.repair_toast_mode || "failures");

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

    // Checkpoint — select
    $("#comfyinject_checkpoint").on("change", function () {
        getSettings().checkpoint = $(this).val();
        saveSettings();
    });

    // Workflow — select
    $("#comfyinject_workflow").on("change", function () {
        getSettings().workflow = $(this).val();
        saveSettings();
    });

    // Negative prompt
    $("#comfyinject_negative_prompt").on("input", function () {
        getSettings().negative_prompt = $(this).val();
        saveSettings();
    });

    // Prepend prompt
    $("#comfyinject_prepend_prompt").on("input", function () {
        getSettings().prepend_prompt = $(this).val();
        saveSettings();
    });

    // Append prompt
    $("#comfyinject_append_prompt").on("input", function () {
        getSettings().append_prompt = $(this).val();
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

    // Max poll attempts
    $("#comfyinject_max_poll_attempts").on("input", function () {
        getSettings().max_poll_attempts = parseInt($(this).val(), 10);
        saveSettings();
    });

    // Resolution lock — toggle
    $("#comfyinject_resolution_lock_enabled").on("change", function () {
        const locked = $(this).prop("checked");
        getSettings().resolution_lock_enabled = locked;
        updateResolutionLockUI(locked);
        saveSettings();
    });

    // Resolution lock — width
    $("#comfyinject_resolution_lock_width").on("input", function () {
        getSettings().resolution_lock.width = parseInt($(this).val(), 10);
        saveSettings();
    });

    // Resolution lock — height
    $("#comfyinject_resolution_lock_height").on("input", function () {
        getSettings().resolution_lock.height = parseInt($(this).val(), 10);
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

    // Shot lock — toggle
    $("#comfyinject_shot_lock_enabled").on("change", function () {
        const locked = $(this).prop("checked");
        getSettings().shot_lock_enabled = locked;
        updateShotLockUI(locked);
        saveSettings();
    });

    // Shot lock — dropdown
    $("#comfyinject_shot_lock_value").on("change", function () {
        getSettings().shot_lock = $(this).val();
        saveSettings();
    });

    // Shot tags
    $("#comfyinject_shot_tags").on("input", ".comfyinject-shot-tag", function () {
        const token = $(this).data("token");
        getSettings().shot_tags[token] = $(this).val();
        saveSettings();
    });

    // Gallery button
    $("#comfyinject_gallery_btn").on("click", function () {
        openGallery();
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

    // Seed lock block toggle
    $("#comfyinject_seed_lock_toggle").on("click", function () {
        $("#comfyinject_seed_lock_block").toggle();
    });


    // Seed lock — toggle
    $("#comfyinject_seed_lock_enabled").on("change", function () {
        const locked = $(this).prop("checked");
        getSettings().seed_lock_enabled = locked;
        updateSeedLockUI(locked);
        saveSettings();
    });

    // Seed lock — mode dropdown
    $("#comfyinject_seed_lock_mode").on("change", function () {
        getSettings().seed_lock_mode = $(this).val();
        // Show/hide the custom seed input based on mode
        $("#comfyinject_seed_lock_custom_input").toggle($(this).val() === "CUSTOM");
        saveSettings();
    });

    // Seed lock — custom value
    $("#comfyinject_seed_lock_value").on("input", function () {
        getSettings().seed_lock_value = parseInt($(this).val(), 10);
        saveSettings();
    });

    // Marker repair notifications
    $("#comfyinject_repair_toast_mode").on("change", function () {
        getSettings().repair_toast_mode = $(this).val();
        saveSettings();
    });

    // Reset button — resets everything except comfy_host, checkpoint, and workflow
    $("#comfyinject_reset").on("click", function () {
        const settings = getSettings();
        const { comfy_host, checkpoint, workflow } = settings;

        // Reset to defaults
        Object.assign(settings, structuredClone(defaultSettings));

        // Restore connection settings
        settings.comfy_host = comfy_host;
        settings.checkpoint = checkpoint;
        settings.workflow = workflow;

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

    // Populate checkpoint and workflow dropdowns
    populateCheckpoints();
    populateWorkflows();
}