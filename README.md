# SafePrompt

> **AI needs context, not your identity.**

SafePrompt is a Chrome extension that helps you review personal information in a prompt before sending it to an AI service. It detects potentially sensitive values in the browser, replaces them with numbered tokens, and asks Google Gemini which details are needed for the task. SafePrompt then applies those decisions locally so the prompt can stay useful while sharing less personal information.

🎥 [Watch the demo](https://youtu.be/1luB4Y-QItI)

## Why I built it

A useful prompt can accidentally include a name, employer, email address, location, or exact salary. Some of that context matters; the exact private value often does not. I built SafePrompt to let people make that distinction before they submit a prompt.

## How it works

```text
Original prompt in the browser
          ↓
Local detection: regular expressions + named entity recognition
          ↓
Local tokenization: [PERSON_1], [ORG_1], [MONEY_1], ...
          ↓
Gemini analyzes the tokenized prompt (Auto protect)
          ↓
KEEP / REPLACE / GENERALIZE / REMOVE
          ↓
SafePrompt transforms the prompt locally
          ↓
You review the protected prompt before submitting it
```

Structured values such as email addresses, phone numbers, US Social Security numbers, payment card numbers, and dollar amounts are detected with regular expressions. A local named entity recognition (NER) model detects people, organizations, and locations. SafePrompt resolves overlapping detections and replaces detected values with tokens. The token-to-original mapping stays in the extension's local runtime state.

In **Auto protect**, Gemini receives the tokenized prompt and decides how to handle each token:

| Decision | Meaning |
| --- | --- |
| **KEEP** | Restore the original value because the exact detail is needed. |
| **REPLACE** | Use a contextual phrase or fictional value instead. |
| **GENERALIZE** | Keep useful context at lower precision. |
| **REMOVE** | Delete an unnecessary detail. |

SafePrompt applies the decisions in the browser. **Gemini does not receive the original values of detected and tokenized items.** A `KEEP` decision restores an original value in the *final prompt*, so that value may reach the destination AI service if you submit it. Always review the resulting prompt before sending it.

## Example

**Original prompt**

> My name is Alex Johnson and I work at Microsoft. I earn $87,456 per year. Please help me write a generic email to my manager asking for a raise.

**Tokenized prompt sent for contextual analysis**

> My name is [PERSON_1] and I work at [ORG_1]. I earn [MONEY_1] per year. Please help me write a generic email to my manager asking for a raise.

**Possible protected prompt**

> I work at my employer. I earn about $85,000 per year. Please help me write a generic email to my manager asking for a raise.

| Detected value | Decision | Result |
| --- | --- | --- |
| Alex Johnson | REMOVE | Name and unnecessary introductory wording removed |
| Microsoft | REPLACE | `my employer` |
| $87,456 | GENERALIZE | `about $85,000` |

This is an illustrative outcome. Detection and Gemini's decisions can vary with the prompt.

## Features

- **Auto protect:** Gemini analyzes a tokenized prompt; SafePrompt applies its decisions locally.
- **Review manually:** Choose how to handle detected values without relying on a Gemini decision.
- **Protection report:** See each detected value, its action, and the reason returned for it.
- **Replacement reference:** Review local mappings for substituted values.
- **Undo:** Restore the prompt text saved before the transformation.
- **Local detection:** Combine regular expressions with a browser-run NER model.

If Gemini analysis fails or reaches a rate limit, manual review remains available.

## Privacy and prototype limitations

SafePrompt's original prompt, detected values, token mapping, and transformations are handled in the browser. The Gemini request contains the tokenized prompt and analysis instructions, not the original values of items that SafePrompt detected. The NER model runs locally after its assets are loaded; the first use may require a model download.

**Tokenization is not a guarantee of anonymity.** Undetected sensitive text remains in the tokenized prompt and can be sent to Gemini in Auto protect. Context around tokens can also reveal information. A `KEEP` result restores an original value before you submit the final prompt. Review both the detections and the final text, especially for sensitive requests.

This is a **ShellHacks 2026 prototype**, not an audited security product. Its current Chrome manifest runs the content script on all URLs, and the Gemini key is bundled into client-side extension code at build time. A `.gitignore` entry for `src/config.js` does not protect a key in a built extension or shared archive. Use a restricted development key, never publish a build containing a private key, and revoke any key that has already been distributed. A production release would put Gemini calls behind a secure backend and narrow site access.

## Getting started

### Requirements

- Google Chrome with access to `chrome://extensions`
- Node.js and npm
- A Gemini API key for the prototype's Auto protect mode
- An internet connection for Gemini calls and the initial NER model download

### Install and configure

```bash
git clone https://github.com/GoodLvck/safe-prompt.git
cd safe-prompt
npm ci
```

Create `src/config.js` with this content, replacing the placeholder with your own development key:

```js
export const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY";
```

`src/config.js` is ignored by Git and is required by `src/ai/geminiClient.js`. There is no `src/config.example.js` in the current project copy. Do not commit, share, or publish `src/config.js` or a build containing a real key.

### Build and load in Chrome

```bash
npm run build
```

The build creates `dist/content.js` and `dist/background.js`. The `dist/` folder is ignored by Git, so rebuild after cloning or changing source files.

1. Open `chrome://extensions` in Chrome and enable **Developer mode**.
2. Select **Load unpacked** and choose the `safe-prompt` project folder (the folder containing `manifest.json`).
3. Open an AI chat page and type a prompt with test data into an editable field.
4. Choose **Auto protect** or **Review manually** when SafePrompt shows a warning. Inspect the result before submitting it.

After changing the source, run `npm run build` again and reload the extension from `chrome://extensions`.

## Project structure

```text
safe-prompt/
├── manifest.json
├── package.json
├── package-lock.json
├── styles.css
├── logo.png
├── src/
│   ├── config.js                 # local key; ignored by Git
│   ├── content.js                # page input and protection workflow
│   ├── background.js             # extension message handler
│   ├── ai/
│   │   └── geminiClient.js       # contextual analysis request
│   ├── detection/
│   │   ├── detector.js
│   │   ├── regexDetector.js
│   │   └── nerDetector.js
│   ├── privacy/
│   │   ├── tokenizer.js
│   │   ├── transformer.js
│   │   └── state.js
│   ├── ui/
│   │   └── warningPanel.js
│   └── utils/
│       └── dom.js
├── wasm/                      # local inference runtime assets
└── dist/                      # generated by npm run build; ignored by Git
```

## Built with

JavaScript, HTML, CSS, Chrome Manifest V3, esbuild, Transformers.js, a Hugging Face NER model, regular expressions, and the Google Gemini API.

## Demo

[Watch SafePrompt on YouTube](https://youtu.be/1luB4Y-QItI). The demo shows **Auto protect** first, followed by **Review manually**, including the protection report and Undo.

## What's next

I want to improve detection accuracy, add user privacy preferences, support more AI interfaces, and move Gemini requests behind a secure backend. I am also interested in fully local contextual analysis.

## Hackathon and author

I built SafePrompt for **ShellHacks 2026**, for the **Assurant: Take Control of AI** challenge.

**Alba Serrano Pérez**
