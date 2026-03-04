# ComfyInject

A SillyTavern extension that automatically generates images from `[[IMG: ... ]]` markers in bot messages using your local ComfyUI instance.

When your LLM outputs a marker, ComfyInject intercepts it, sends the prompt to ComfyUI, and replaces the marker with the generated image — all without leaving the chat. Images are saved permanently into the chat history and survive page reloads. Outbound prompts sent to the LLM replace injected images with a compact token so the model maintains visual continuity across the conversation.

---

## Requirements

- [SillyTavern](https://github.com/SillyTavern/SillyTavern)
- A local [ComfyUI](https://github.com/comfyanonymous/ComfyUI) instance
> Tested on SillyTavern **1.16** (latest stable release). Compatibility with staging/nightly builds is not guaranteed.

---

## Installation

### Step 1 — Install the extension

**Option A — ST's built-in installer (recommended):**
1. Open the Extensions panel in SillyTavern
2. Click **Install extension** and paste in the repo URL:
   ```
   https://github.com/Spadic21/ComfyInject
   ```

**Option B — Git (command line):**
```
git clone https://github.com/Spadic21/ComfyInject "SillyTavern/public/scripts/extensions/third-party/ComfyInject"
```

**Option C — Manual download:**
Download this repo as a ZIP, unzip it, and place the folder here:
```
SillyTavern/
└── public/
    └── scripts/
        └── extensions/
            └── third-party/
                └── ComfyInject/  ← here
```

If you used Option B or C, go to the Extensions panel, find ComfyInject in the list, and toggle it ON, then reload SillyTavern.

---

### Step 2 — Enable the CORS header in ComfyUI

ComfyInject needs to talk to ComfyUI from the browser, which requires CORS to be enabled.

**If you use the ComfyUI Desktop app:**
Open ComfyUI → Settings → **Server-Config** → enable the CORS header option. You'll see `--enable-cors-header *` appear at the top when it's active. The `*` allows all origins — you can restrict it to `http://127.0.0.1:8000` if you prefer, or whatever domain you use for your ST session.

**If you use the portable package or manual install:**
Launch ComfyUI with the flag:
```
python main.py --enable-cors-header
```
---
### Step 3 — Configure the extension

Before ComfyInject can generate anything, two settings in `settings.js` **must** be set correctly:

- **`comfy_host`** — the URL of your ComfyUI instance. Default is `http://127.0.0.1:8188` which is correct for most local installs. Change this if you're running ComfyUI on a different port or machine.
- **`checkpoint`** — the filename of your model **exactly** as it appears in ComfyUI's model list. Example: `waiIllustriousSDXL_v160.safetensors`. The default value will not work unless you happen to have that exact file.

All other settings have sensible defaults and don't need to be changed to get started. See the [Configuration](#configuration) section for the full list.

---
## Configuration

Open `settings.js` and update the following:

| Setting | Description |
|---|---|
| `comfy_host` | URL of your ComfyUI instance. Default: `http://127.0.0.1:8188` |
| `checkpoint` | Filename of your model as it appears in ComfyUI. Must match exactly. |
| `negative_prompt` | Negative prompt applied to every generation. |
| `steps` | Number of sampling steps. |
| `cfg` | Classifier-Free Guidance scale. |
| `sampler` | Sampler name (must be valid in your ComfyUI version). |
| `scheduler` | Scheduler name (must be valid in your ComfyUI version). |
| `denoise` | Denoise strength (1.0 for full generation). |
| `resolutions` | Width/height per AR token. Adjust for your model (SDXL needs higher values). |

> **Note for SDXL users:** Default resolutions are SD1.5 sized (512px). Bump them up — e.g. PORTRAIT to 832×1216.

---

## Marker Format

Instruct your LLM to output image markers using this exact format:

```
[[IMG: PROMPT | AR | SHOT | SEED ]]
```

### Segments

**PROMPT** — Danbooru-style comma-separated tags describing only what a camera would see. Recommended tag order:
1. Subject (`1girl`, `1boy`, etc.)
2. Features (hair color, eye color, clothing, expression, body)
3. Environment (location, lighting, weather)
4. Modifiers (style, additional visible details)

**AR** — Aspect ratio. Must be one of:

| Token | Resolution (default) |
|---|---|
| `PORTRAIT` | 512 × 768 |
| `SQUARE` | 512 × 512 |
| `LANDSCAPE` | 768 × 512 |
| `CINEMA` | 768 × 432 |

**SHOT** — Camera shot type. Each token prepends Danbooru tags to the positive prompt automatically:

| Token | Tags injected |
|---|---|
| `CLOSE` | `close-up, face focus` |
| `MEDIUM` | `upper body` |
| `WIDE` | `full body` |
| `DUTCH` | `dutch angle` |
| `OVERHEAD` | `from above, bird's eye view` |
| `LOWANGLE` | `from below` |
| `HIGHANGLE` | `from above` |
| `PROFILE` | `profile, from side` |
| `BACKVIEW` | `from behind` |
| `POV` | `pov` |

To change these tags, edit the `SHOT_TAGS` object in `src/comfy.js`.

**SEED** — Seed control:

| Value | Behaviour |
|---|---|
| `RANDOM` | Generate a new random seed |
| `LOCK` | Reuse the last generated seed (visual continuity) |
| integer | Use a specific seed |

### Example

```
[[IMG: 1girl, long red hair, green eyes, white sundress, standing in heavy rain, wet cobblestone street, neon lights reflecting in puddles, cinematic lighting | PORTRAIT | MEDIUM | RANDOM ]]
```

---

## System Prompt

Add the following to your **Post-History Instructions** (You can also place it in **Author's Note**, **Prompt Content**, or even in your **Summary** if that's what you want!). Placing it there puts it closer to the end of the context window, which gives significantly better format compliance than a top-level system prompt.

```
IMAGE INJECTION RULES
You MUST include exactly one image marker in EVERY response without exception.
A response without an image marker is an error. Do not skip it for any reason.

The marker must follow this exact format:
[[IMG: PROMPT | AR | SHOT | SEED ]]

Exactly four segments separated by the pipe character |. No additional brackets. No extra segments. Place the marker at the most narratively appropriate point in your response.

PROMPT:
A comma-delimited list of Danbooru tags describing only what a camera would see.
Construct tags in this exact order:
1. Subject (1girl, 2girls, 1boy, etc.)
2. Features (hair color, eye color, clothing, expression, body) — use ONLY details explicitly stated in the character card, memory, or previous image markers. Do not invent or assume any visual details.
3. Environment/Background (location, lighting, weather)
4. Modifiers (style, additional visible details)

If the scene is erotic, prepend the entire prompt with "erotic," before the subject.
No emotional adjectives. No abstract themes. No metaphor. Only visible, concrete tags.
If characters are physically interacting, specify exactly which body parts are interacting and how.

AR must be exactly one of:
PORTRAIT, SQUARE, LANDSCAPE, CINEMA

SHOT must be exactly one of:
CLOSE, MEDIUM, WIDE, DUTCH, OVERHEAD, LOWANGLE, HIGHANGLE, PROFILE, BACKVIEW, POV

SEED must be exactly one of:
LOCK, RANDOM, or a numeric integer.
Use RANDOM for the first image of a new character or scene.
Use LOCK to maintain the appearance of the previous image.
Use a numeric integer to match a specific previous generation.

Maintain scene consistency: reference previous image markers for character appearance before referencing the character card. Do not change established visual details unless the story explicitly changes them.

Full example of a correct marker:
[[IMG: 1girl, long red hair, green eyes, white sundress, standing in heavy rain, wet cobblestone street, neon lights reflecting in puddles, cinematic lighting | PORTRAIT | MEDIUM | RANDOM ]]

If any segment is invalid or missing, regenerate the entire marker before continuing.
Never explain or mention the marker in narration.
```

> **Model recommendations:** Larger models (70B+) or cloud APIs like DeepSeek V3.2 follow the format far more reliably than small local models. Models under 13B tend to produce inconsistent markers and hallucinate character details.

---

## Custom Workflows

The default workflow (`workflows/comfyinject_default.json`) uses only built-in ComfyUI nodes and works out of the box with any standard checkpoint.

To use your own workflow, see `workflows/README.md` for placeholder requirements.

---

## How It Works

1. Bot message arrives containing `[[IMG: ... ]]`
2. ComfyInject parses the marker and resolves the seed
3. The workflow is filled with your settings and sent to ComfyUI
4. ComfyInject polls `/history` until the image is ready
5. The marker is replaced with an `<img>` tag in the chat permanently
6. The image URL and prompt are saved to chat metadata
7. On the next generation, the `<img>` tag is ephemerally replaced with `[[IMG: prompt | seed ]]` in the outbound prompt so the LLM sees a token-efficient reference instead of raw HTML

---

## Known Limitations

- Images link to your local ComfyUI `/view` endpoint. If ComfyUI is not running on reload, images will not display (the `<img>` tag is saved but the file must be served by ComfyUI).
- The generating placeholder does not appear for messages processed on extension activation — only for live newly generated messages. This is a cosmetic limitation with no impact on functionality.
- Only one `[[IMG: ... ]]` marker per message is processed.

---

## License

AGPLv3 — see [LICENSE](LICENSE) for details.

---

*Built with VSCode and an embarrassing amount of help from [Claude](https://claude.ai) by Anthropic.*
