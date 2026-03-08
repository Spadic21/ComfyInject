<a id="readme-top"></a>

# ComfyInject

A SillyTavern extension that automatically generates images from `[[IMG: ... ]]` markers in bot messages using your local ComfyUI instance.

When your LLM outputs a marker, ComfyInject intercepts it, sends the prompt to ComfyUI, and replaces the marker with the generated image — all without leaving the chat. Multiple images per message are supported. Images are saved permanently into the chat history and survive page reloads. Outbound prompts sent to the LLM replace injected images with a compact token so the model maintains visual continuity across the conversation.

<details>
  <summary>Table of Contents</summary>
  <ol>
    <li><a href="#requirements">Requirements</a></li>
    <li>
      <a href="#installation">Installation</a>
      <ul>
        <li><a href="#step-1--install-the-extension">Step 1 — Install the extension</a></li>
        <li><a href="#step-2--enable-the-cors-header-in-comfyui">Step 2 — Enable the CORS header in ComfyUI</a></li>
        <li><a href="#step-3--configure-the-extension">Step 3 — Configure the extension</a></li>
        <li><a href="#step-4--set-up-your-llm">Step 4 — Set up your LLM</a></li>
      </ul>
    </li>
    <li><a href="#configuration">Configuration</a></li>
    <li><a href="#marker-format">Marker Format</a></li>
    <li><a href="#system-prompt">System Prompt</a></li>
    <li><a href="#image-gallery">Image Gallery</a></li>
    <li><a href="#retry-button">Retry Button</a></li>
    <li><a href="#custom-workflows">Custom Workflows</a></li>
    <li><a href="#how-it-works">How It Works</a></li>
    <li><a href="#known-limitations">Known Limitations</a></li>
    <li><a href="#faq">FAQ</a></li>
    <li><a href="#license">License</a></li>
  </ol>
</details>

---

## Requirements

- [SillyTavern](https://github.com/SillyTavern/SillyTavern)
- A local [ComfyUI](https://github.com/comfyanonymous/ComfyUI) instance
> Tested on SillyTavern **1.16** (latest stable release) and staging. Should work on any recent version.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

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
1. Navigate to your SillyTavern root directory in File Explorer, click the address bar, type cmd and press Enter. This opens a command prompt directly in that folder.
2. Paste this command in there:
```
git clone https://github.com/Spadic21/ComfyInject "public/scripts/extensions/third-party/ComfyInject"
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

---

### Step 2 — Enable the CORS header in ComfyUI

ComfyInject needs to talk to ComfyUI from the browser, which requires CORS to be enabled.

**If you use the ComfyUI Desktop app:**
Open ComfyUI → Settings → **Server-Config** → enable the CORS header option. You'll see `--enable-cors-header *` appear at the top when it's active. The `*` allows all origins — you can restrict it to `http://127.0.0.1:8000` if you prefer, or whatever domain you use for your ST session.

**If you use the portable package:**
Open `run_nvidia_gpu.bat` (or whichever `.bat` file you use) in a text editor.
Find the line that starts with `.\python_embeded\python.exe`
Add `--enable-cors-header` to the end of that line. It should look like this:
```
.\python_embeded\python.exe -s ComfyUI\main.py --windows-standalone-build --enable-cors-header
```

**If you use the manual install:**
Launch ComfyUI with the flag:
```
python main.py --enable-cors-header
```

---

### Step 3 — Configure the extension

Before ComfyInject can generate anything, two settings **must** be configured. Open the Extensions panel in SillyTavern, find ComfyInject, and set:

- **ComfyUI Host** — the URL of your ComfyUI instance. Default is `http://127.0.0.1:8188` which is correct for most local installs. Change this if you're running ComfyUI on a different port or machine.
- **Checkpoint** — the filename of your model **exactly** as it appears in ComfyUI's model list and model folder. Example: `waiIllustriousSDXL_v160.safetensors`. You can click the dropdown arrow next to the text field to fetch and select from your available checkpoints directly. Not sure where to find this? See the [FAQ](#how-do-i-find-my-checkpoint-filename-in-comfyui).

All other settings have sensible defaults and don't need to be changed to get started. See the [Configuration](#configuration) section for the full list.

---

### Step 4 — Set up your LLM

ComfyInject won't generate anything unless your LLM knows to output the `[[IMG: ... ]]` marker format.

- **To get up and running fast:** copy the ready-made prompt from the [System Prompt](#system-prompt) section and paste it into your character's Post-History Instructions (Author's Note in ST).
- **To write your own:** see the [Marker Format](#marker-format) section for the full spec.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

---

## Configuration

All settings are available in the Extensions panel in SillyTavern under **ComfyInject**. The required settings are visible immediately. Everything else is under **Advanced Settings**.

### Connection & Model

| Setting | Description |
|---|---|
| `ComfyUI Host` | URL of your ComfyUI instance. Default: `http://127.0.0.1:8188` |
| `Checkpoint` | Filename of your model as it appears in ComfyUI. Must match exactly. Click the dropdown arrow to fetch available checkpoints. |
| `Workflow` | Filename of the workflow JSON in the `workflows/` folder. Default: `comfyinject_default.json`. Validated automatically after you stop typing. |

### Prompt Control

| Setting | Description |
|---|---|
| `Prepend Prompt` | Custom tags added to the **start** of every positive prompt, before shot tags and the LLM's output. |
| `Negative Prompt` | Negative prompt applied to every generation. |
| `Append Prompt` | Custom tags added to the **end** of every positive prompt, after the LLM's output. |

### Sampler Settings

| Setting | Description |
|---|---|
| `Steps` | Number of sampling steps. |
| `CFG` | Classifier-Free Guidance scale. |
| `Sampler` | Sampler name (must be valid in your ComfyUI version). |
| `Scheduler` | Scheduler name (must be valid in your ComfyUI version). |
| `Denoise` | Denoise strength (1.0 for full generation). |

### Resolution & Locks

| Setting | Description |
|---|---|
| `Resolutions` | Width/height per AR token. Adjust for your model (SDXL needs higher values). |
| `Lock Resolution` | When enabled, ignores the LLM's AR token and uses a single fixed resolution for all generations. |
| `Lock Shot` | When enabled, ignores the LLM's SHOT token and uses a fixed shot type for all generations. |
| `Lock Seed` | When enabled, ignores the LLM's SEED token. Modes: `RANDOM` (always new), `LOCK` (reuse last message's seed), or `CUSTOM` (specific number). |

### Shot Tags

| Setting | Description |
|---|---|
| `Shot Tags` | Danbooru tags prepended to the prompt for each SHOT token. Fully customizable. |

### Marker Defaults

| Setting | Description |
|---|---|
| `Default AR` | Fallback AR when marker AR is missing/invalid. Can be `RANDOM` or a fixed AR token. |
| `Default SHOT` | Fallback SHOT when marker SHOT is missing/invalid. Can be `RANDOM` or a fixed SHOT token. |
| `Default SEED` | Fallback SEED when marker SEED is missing/invalid. Modes: `RANDOM`, `LOCK`, or `CUSTOM` integer. |

When `Lock Seed` is enabled, it still takes precedence over marker/default SEED behavior.

> **Note for SDXL users:** Default resolutions are SD1.5 sized (512px). Bump them up — e.g. PORTRAIT to 832x1216.

To reset all advanced settings back to defaults while keeping your host, checkpoint, and workflow, press the **Reset Advanced to Defaults** button at the bottom of the Advanced Settings panel.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

---

## Marker Format

Instruct your LLM to output image markers using this exact format:

```
[[IMG: PROMPT | AR | SHOT | SEED ]]
```

Multiple markers per message are supported — each one generates a separate image.

ComfyInject uses a lenient parser:
- Missing AR/SHOT/SEED fields are auto-filled from **Marker Defaults**.
- AR/SHOT/SEED can be out of order and are detected by token type.
- Duplicate AR/SHOT/SEED fields keep the first value and ignore later duplicates.
- The only parser hard-fail is an empty prompt, shown as `[Image marker invalid: empty prompt]`.

### Segments

**PROMPT** — Danbooru-style comma-separated tags describing only what a camera would see. Recommended tag order:
1. Subject (`1girl`, `1boy`, etc.)
2. Features (hair color, eye color, clothing, expression, body)
3. Environment (location, lighting, weather)
4. Modifiers (style, additional visible details)

**AR** — Aspect ratio. Must be one of:

| Token | Resolution (default) |
|---|---|
| `PORTRAIT` | 512 x 768 |
| `SQUARE` | 512 x 512 |
| `LANDSCAPE` | 768 x 512 |
| `CINEMA` | 768 x 432 |

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

To change these tags, open the Extensions panel → ComfyInject → **Advanced Settings** → **Shot Tags**.

**SEED** — Seed control:

| Value | Behaviour |
|---|---|
| `RANDOM` | Generate a new random seed |
| `LOCK` | Reuse the seed from the last saved message (stable across swipes) |
| integer | Use a specific seed |

### Example

```
[[IMG: 1girl, long red hair, green eyes, white sundress, standing in heavy rain, wet cobblestone street, neon lights reflecting in puddles, cinematic lighting | PORTRAIT | MEDIUM | RANDOM ]]
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

---

## System Prompt

Add the following to your **Post-History Instructions** (You can also place it in **Author's Note**, **Prompt Content**, or even in your **Summary** if that's what you want!). Placing it there puts it closer to the end of the context window, which gives significantly better format compliance than a top-level system prompt.

The example below tells the LLM to include one image per message. You can change the number to whatever you want, or tell it to include images "when narratively appropriate" for more flexibility.

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

<p align="right">(<a href="#readme-top">back to top</a>)</p>

---

## Image Gallery

ComfyInject includes a built-in image gallery accessible from the extension panel. Click the **Image Gallery** button to open it.

The gallery shows all generated images in the current chat as a grid of thumbnails. Each thumbnail displays the seed and message number. Click any image to expand it and see the full details:

- **Seed** — the numeric seed used for generation
- **Prompt** — the full Danbooru tag prompt the LLM wrote
- **AR** — the aspect ratio token and actual resolution used (shows `LOCKED` if resolution lock was active)
- **Shot** — the shot type token and actual tags injected (shows `LOCKED` if shot lock was active)
- **Filename** — the output filename in ComfyUI's output folder
- **Prompt ID** — the ComfyUI job ID, clickable as a link to the ComfyUI history endpoint for debugging

The gallery always reflects what's currently on screen — swiping to a different response updates the gallery accordingly.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

---

## Retry Button

Every generated image has a small retry button (rotate icon) in the top-right corner. Clicking it regenerates that specific image with a new random seed while keeping the same prompt, aspect ratio, and shot type. The retry button always bypasses the seed lock setting to guarantee a different result.

During regeneration, the button shows a spinning icon. The new image replaces the old one in the chat and is saved permanently.

In messages with multiple images, each retry button only affects its own image — the others are left untouched.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

---

## Custom Workflows

The default workflow (`workflows/comfyinject_default.json`) uses only built-in ComfyUI nodes and works out of the box with any standard checkpoint.

To use your own workflow, see `workflows/README.md` for placeholder requirements. Once your workflow JSON is in the `workflows/` folder, type its filename into the **Workflow** field in the extension settings. The field validates automatically — you'll see a success or error notification after you stop typing.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

---

## How It Works

1. Bot message arrives containing one or more `[[IMG: ... ]]` markers
2. ComfyInject parses each marker and resolves seeds, applying any active locks
3. For each marker, the workflow is filled with your settings and sent to ComfyUI sequentially
4. ComfyInject polls `/history` until each image is ready
5. Each marker is replaced with an `<img>` tag in the chat permanently
6. Image metadata (seed, AR, shot, prompt ID, filename) is saved to chat metadata keyed by message timestamp for stability across deletions
7. On the next generation, the outbound interceptor replaces `<img>` tags with `[[IMG: prompt | seed ]]` tokens so the LLM sees a compact text reference instead of raw HTML
8. Retry buttons are injected via DOM manipulation after each render

<p align="right">(<a href="#readme-top">back to top</a>)</p>

---

## Known Limitations

- Images link to your local ComfyUI `/view` endpoint. If ComfyUI is not running on reload, images will not display (the `<img>` tag is saved but the file must be served by ComfyUI).
- The generating placeholder may not appear on some versions of SillyTavern. This is a cosmetic limitation with no impact on functionality.
- Deleted messages leave orphaned image files in ComfyUI's output folder. ComfyInject does not delete these files — manage your ComfyUI output folder as needed.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

---

## FAQ

### How do I find my checkpoint filename in ComfyUI?

The easiest way is to click the dropdown arrow next to the Checkpoint field in ComfyInject's settings — if ComfyUI is running, it will fetch and display all your available checkpoints for you to select from.

Alternatively, open your ComfyUI root folder and navigate to `ComfyUI/models/checkpoints`. The filenames of the models in that folder are exactly what you need to paste into ComfyInject's Checkpoint field, including the file extension (e.g. `waiIllustriousSDXL_v160.safetensors`).

You can also find it in ComfyUI itself — open ComfyUI, load any workflow, and find the Load Checkpoint node. Click the dropdown on that node and you'll see a list of all your available models. Note down whichever one you want and type it exactly into ComfyInject's Checkpoint field.

If the checkpoints folder is empty or the dropdown shows nothing, you'll need to download a model first. SD1.5 is a good beginner friendly starting point. You can find models on Hugging Face or Civitai. Once downloaded, drop the model file into the `ComfyUI/models/checkpoints` folder and restart ComfyUI. After that, the model should appear in both ComfyUI and ComfyInject's dropdown.

---

### How is this different from ST's built in image generation?

ST's built in image generation builds the prompt itself from the chat context — the LLM has no awareness of the image at all. It also requires a Chat Completion API with function calling enabled, so text completion users can't use it.

With ComfyInject the LLM writes the image prompt directly into its response, controls the framing and seed, and can reference its own previous images for visual continuity via the outbound interceptor. It works with any backend and any LLM that can follow structured output instructions.

---

### Can I use my own custom workflow?

Yes! Export your workflow from ComfyUI using Save (API format), replace the relevant values with ComfyInject's placeholder strings, and save it to the `workflows/` folder. Then type the filename into the Workflow field in the extension settings. See `workflows/README.md` for the full list of placeholders and instructions. ComfyInject only touches the nodes where you place its placeholders — everything else in your workflow stays exactly as you have it.

---

### Does it work with text completion backends?

Yes! The marker approach works with any LLM that can follow structured output instructions regardless of backend. The outbound interceptor replaces injected images with a compact text token containing the original prompt and seed, so even non vision models can reference previous images for continuity.

---

### Can I have multiple images per message?

Yes! The LLM can include as many `[[IMG: ... ]]` markers as you want in a single message. Each marker generates a separate image sequentially. Adjust your system prompt to tell the LLM how many images to include per message.

---

### What do the lock settings do?

The lock settings let you override specific parameters regardless of what the LLM outputs:

- **Lock Resolution** — forces a single fixed resolution for all generations, ignoring the LLM's AR token.
- **Lock Shot** — forces a single shot type for all generations, ignoring the LLM's SHOT token.
- **Lock Seed** — forces a seed mode (RANDOM, LOCK, or a specific number) for all generations, ignoring the LLM's SEED token.

The LLM still outputs its tokens normally — the locks just override them at generation time. The gallery shows what was actually sent to ComfyUI so you can verify.

---

### Why isn't my image generating?

A few things to check:
- Make sure ComfyUI is running and `--enable-cors-header` is enabled
- Make sure the Checkpoint field in ComfyInject's settings matches your model filename exactly, including the file extension
- Make sure the Workflow field points to a valid workflow JSON in the `workflows/` folder
- Check the browser console for any error messages from ComfyInject
- Make sure your LLM is outputting the marker in the correct format — see the [Marker Format](#marker-format) section

<p align="right">(<a href="#readme-top">back to top</a>)</p>

---

## License

AGPLv3 — see [LICENSE](LICENSE) for details.

---

*Built with VSCode and an embarrassing amount of help from [Claude](https://claude.ai) by Anthropic.*