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
    } catch (err) {
        return [];
    }
}

/**
 * Validates that a workflow file exists in the workflows folder.
 * Shows a toastr error if the file doesn't exist, success if it does.
 * @param {string} filename - The workflow filename to validate
 */
async function validateWorkflow(filename) {
    if (!filename || !filename.trim()) return;
    try {
        const response = await fetch(`/${EXTENSION_FOLDER}/workflows/${filename.trim()}`, { method: "HEAD" });
        if (response.ok) {
            toastr.success(`Workflow "${filename}" found!`, "ComfyInject");
        } else {
            toastr.error(`Workflow "${filename}" not found in the workflows folder.`, "ComfyInject");
        }
    } catch (err) {
        toastr.error(`Could not check workflow file.`, "ComfyInject");
    }
}

/**
 * Fetches checkpoints from ComfyUI and populates the dropdown.
 * Called on init and when the arrow button is clicked.
 * @param {boolean} [showToast=true] - Whether to show a toast notification
 */
async function refreshCheckpointList(showToast = true) {
    const checkpoints = await fetchCheckpoints();
    const dropdown = $("#comfyinject_checkpoint_dropdown");
    dropdown.empty();

    if (checkpoints.length > 0) {
        const current = getSettings().checkpoint;
        for (const name of checkpoints) {
            dropdown.append(
                `<div class="comfyinject-checkpoint-option" data-value="${name}" style="padding: 6px 10px; cursor: pointer; ${name === current ? "font-weight: bold;" : ""}">${name}</div>`
            );
        }
        if (showToast) {
            toastr.success(`Found ${checkpoints.length} checkpoint(s)`, "ComfyInject");
        }
    } else if (showToast) {
        toastr.warning("Could not reach ComfyUI. Is it running?", "ComfyInject");
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

    // Checkpoint — text input
    $("#comfyinject_checkpoint").on("input", function () {
        getSettings().checkpoint = $(this).val();
        saveSettings();
    });

    // Checkpoint — arrow button toggles dropdown
    $("#comfyinject_checkpoint_arrow").on("click", function () {
        const dropdown = $("#comfyinject_checkpoint_dropdown");
        if (dropdown.children().length === 0) {
            // No checkpoints fetched yet — trigger a fetch
            refreshCheckpointList(true).then(() => {
                if ($("#comfyinject_checkpoint_dropdown").children().length > 0) {
                    dropdown.show();
                }
            });
        } else {
            dropdown.toggle();
        }
    });

    // Checkpoint — clicking an option fills the text input and closes the dropdown
    $("#comfyinject_checkpoint_dropdown").on("click", ".comfyinject-checkpoint-option", function () {
        const value = $(this).data("value");
        $("#comfyinject_checkpoint").val(value);
        getSettings().checkpoint = value;
        saveSettings();
        $("#comfyinject_checkpoint_dropdown").hide();
    });

    // Checkpoint — hover highlight
    $("#comfyinject_checkpoint_dropdown").on("mouseenter", ".comfyinject-checkpoint-option", function () {
        $(this).css("background", "var(--SmartThemeQuoteColor)");
    }).on("mouseleave", ".comfyinject-checkpoint-option", function () {
        $(this).css("background", "");
    });

    // Close dropdown when clicking outside
    $(document).on("click", function (e) {
        if (!$(e.target).closest("#comfyinject_checkpoint_arrow, #comfyinject_checkpoint_dropdown").length) {
            $("#comfyinject_checkpoint_dropdown").hide();
        }
    });

    // Workflow — debounced validation after typing stops
    let workflowValidateTimer = null;
    $("#comfyinject_workflow").on("input", function () {
        getSettings().workflow = $(this).val();
        saveSettings();

        // Debounce — validate 1.5s after the user stops typing
        clearTimeout(workflowValidateTimer);
        workflowValidateTimer = setTimeout(() => {
            validateWorkflow($(this).val());
        }, 1500);
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

    // Silently try to populate the checkpoint list on load — no toast if ComfyUI isn't running
    refreshCheckpointList(false);
}