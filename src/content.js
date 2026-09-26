import { detectSensitiveEntities } from "./detection/detector.js";
import { tokenizePrompt } from "./privacy/tokenizer.js";
import { safePromptState } from "./privacy/state.js";

import {
  showWarning,
  removeExistingWarning
} from "./ui/warningPanel.js";

function getTextFromElement(element) {
  if (element.isContentEditable) {
    return element.innerText;
  }

  return element.value;
}

function isSupportedInput(element) {
  if (!element) return false;

  // Ignore SafePrompt's own UI
  if (
    element.closest?.("#safeprompt-warning")
  ) {
    return false;
  }

  if (element.tagName === "TEXTAREA") {
    return true;
  }

  if (element.isContentEditable) {
    return true;
  }

  if (element.tagName === "INPUT") {
    const type =
      (element.type || "text").toLowerCase();

    const allowedTypes = [
      "text",
      "search",
      "email",
      "tel",
      "url"
    ];

    return allowedTypes.includes(type);
  }

  return false;
}

async function handlePromptInput(event) {
  const element = event.target;

  if (!isSupportedInput(element)) {
    return;
  }

  const text =
    getTextFromElement(element);

  if (!text || !text.trim()) {
    removeExistingWarning();
    return;
  }

  const detectedItems =
    await detectSensitiveEntities(text);

  if (detectedItems.length === 0) {
    removeExistingWarning();
    return;
  }

  const {
    tokenizedText,
    items,
    privateMap
  } = tokenizePrompt(
    text,
    detectedItems
  );

  safePromptState.originalPrompt =
    text;

  safePromptState.tokenizedPrompt =
    tokenizedText;

  safePromptState.detectedItems =
    items;

  safePromptState.privateMap =
    privateMap;

  safePromptState.activeElement =
    element;

  showWarning(
    element,
    safePromptState
  );
}

let typingTimer;

document.addEventListener(
  "input",
  (event) => {

    // Ignore SafePrompt controls
    if (
      event.target.closest?.(
        "#safeprompt-warning"
      )
    ) {
      return;
    }

    clearTimeout(typingTimer);

    typingTimer = setTimeout(
      () => {
        handlePromptInput(event);
      },
      500
    );
  }
);
