# Custom Workflows

Place your ComfyUI workflow JSON files here.

ComfyInject ships with `comfyinject_default.json` which works out of the box using only built-in ComfyUI nodes. You only need a custom workflow if you want to use custom nodes, ControlNet, LoRAs wired in at the node level, or any other advanced setup.

---

## Placeholder Requirements

Your workflow JSON must use the following placeholder strings exactly as shown. ComfyInject will replace them with real values before sending to ComfyUI.

| Placeholder | Type | Description |
|---|---|---|
| `"{{CHECKPOINT}}"` | string | Checkpoint filename |
| `"{{POSITIVE_PROMPT}}"` | string | Shot tags + user prompt |
| `"{{NEGATIVE_PROMPT}}"` | string | Negative prompt from settings |
| `"{{WIDTH}}"` | integer | Image width in pixels |
| `"{{HEIGHT}}"` | integer | Image height in pixels |
| `"{{SEED}}"` | integer | Resolved numeric seed |
| `"{{STEPS}}"` | integer | Sampling steps |
| `"{{CFG}}"` | float | CFG scale |
| `"{{SAMPLER}}"` | string | Sampler name |
| `"{{SCHEDULER}}"` | string | Scheduler name |
| `"{{DENOISE}}"` | float | Denoise strength |

> The quotes are part of the placeholder syntax. In your JSON file, the value field must be the placeholder string in quotes, e.g. `"seed": "{{SEED}}"`. ComfyInject replaces the entire quoted string including the quotes with the correct typed value.

---

## Using a Custom Workflow

1. Export your workflow from ComfyUI using **Save (API format)** — not the regular Save.
2. Replace the literal values in your exported JSON with the placeholder strings from the table above.
3. Save the file into this folder.
4. Update `comfy.js` to load your filename instead of `comfyinject_default.json`.