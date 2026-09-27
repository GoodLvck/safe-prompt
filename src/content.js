import { detectSensitiveEntities } from "./detection/detector.js";
import { tokenizePrompt } from "./privacy/tokenizer.js";
import { safePromptState } from "./privacy/state.js";
import {
  showWarning,
  showManualReview,
  removeExistingWarning,
  showProtectionConfirmation,
  showProtectionReport,
  showAnalyzingState,
  showProtectionError,
} from "./ui/warningPanel.js";
import { transformPrompt } from "./privacy/transformer.js";
import { getTextFromElement, setTextToElement } from "./utils/dom.js";

let isSafePromptUpdating = false;
let isAutoProtectRunning = false;

function isSupportedInput(element) {
  if (!element) return false;

  // Ignore SafePrompt's own UI
  if (element.closest?.("#safeprompt-warning")) {
    return false;
  }

  if (element.tagName === "TEXTAREA") {
    return true;
  }

  if (element.isContentEditable) {
    return true;
  }

  if (element.tagName === "INPUT") {
    const type = (element.type || "text").toLowerCase();

    const allowedTypes = ["text", "search", "email", "tel", "url"];

    return allowedTypes.includes(type);
  }

  return false;
}
function handleProtectionError(error) {
  console.error("SafePrompt protection error:", error);

  let message = "SafePrompt couldn't analyze this prompt.";

  if (error.message?.includes("429")) {
    message = "AI rate limit reached. Try again later or use manual review.";
  } else if (error.message?.toLowerCase().includes("network")) {
    message = "Network error. Check your connection and try again.";
  }

  showProtectionError(safePromptState.activeElement, message, {
    onRetry: handleAutoProtect,

    onClose: removeExistingWarning,
  });
}

async function handlePromptInput(event) {
  if (isSafePromptUpdating) {
    return;
  }

  const element = event.target;

  if (!isSupportedInput(element)) {
    return;
  }

  const text = getTextFromElement(element);

  if (!text || !text.trim()) {
    removeExistingWarning();
    return;
  }

  const detectedItems = await detectSensitiveEntities(text);

  if (detectedItems.length === 0) {
    removeExistingWarning();
    return;
  }

  const { tokenizedText, items, privateMap } = tokenizePrompt(
    text,
    detectedItems,
  );

  safePromptState.originalPrompt = text;

  safePromptState.tokenizedPrompt = tokenizedText;

  safePromptState.detectedItems = items;

  safePromptState.privateMap = privateMap;

  safePromptState.activeElement = element;

  showWarning(element, safePromptState, {
    onAutoProtect: handleAutoProtect,

    onReview: () => {
      showManualReview(element, safePromptState, {
        onApplyManual: handleManualProtect,
      });
    },
  });
}

function handleManualProtect(manualDecisions) {
  safePromptState.aiDecisions = manualDecisions;

  const transformation = transformPrompt(
    safePromptState.tokenizedPrompt,
    manualDecisions,
    safePromptState.privateMap,
  );

  safePromptState.protectedPrompt = transformation.protectedPrompt;

  safePromptState.replacementMap = transformation.replacementMap;

  safePromptState.report = transformation.report;

  clearTimeout(typingTimer);

  isSafePromptUpdating = true;

  setTextToElement(
    safePromptState.activeElement,
    safePromptState.protectedPrompt,
  );

  setTimeout(() => {
    isSafePromptUpdating = false;
  }, 0);

  showProtectionConfirmation(safePromptState.activeElement, safePromptState, {
    onReport: handleReport,
    onUndo: handleUndo,
  });
}

async function handleAutoProtect() {
  if (isAutoProtectRunning) {
    return;
  }

  isAutoProtectRunning = true;

  try {
    showAnalyzingState(safePromptState.activeElement);

    const response = await requestPrivacyAnalysis(
      safePromptState.tokenizedPrompt,
    );

    const decisions = response.decisions;

    safePromptState.aiDecisions = decisions;

    const transformation = transformPrompt(
      safePromptState.tokenizedPrompt,
      decisions,
      safePromptState.privateMap,
    );

    safePromptState.protectedPrompt = transformation.protectedPrompt;

    safePromptState.replacementMap = transformation.replacementMap;

    safePromptState.report = transformation.report;

    clearTimeout(typingTimer);

    isSafePromptUpdating = true;

    setTextToElement(
      safePromptState.activeElement,
      safePromptState.protectedPrompt,
    );

    setTimeout(() => {
      isSafePromptUpdating = false;
    }, 0);

    showProtectionConfirmation(safePromptState.activeElement, safePromptState, {
      onReport: handleReport,
      onUndo: handleUndo,
    });
  } catch (error) {
    handleProtectionError(error);
  } finally {
    isAutoProtectRunning = false;
  }
}

async function requestPrivacyAnalysis(tokenizedPrompt) {
  const response = await chrome.runtime.sendMessage({
    type: "ANALYZE_PROMPT",
    tokenizedPrompt,
  });

  if (!response?.success) {
    throw new Error(response?.error || "SafePrompt analysis failed.");
  }

  return response.result;
}

let typingTimer;

document.addEventListener("input", (event) => {
  // Ignore changes made by SafePrompt itself
  if (isSafePromptUpdating) {
    return;
  }

  // Ignore SafePrompt UI controls
  if (event.target.closest?.("#safeprompt-warning")) {
    return;
  }

  clearTimeout(typingTimer);

  typingTimer = setTimeout(() => {
    handlePromptInput(event);
  }, 500);
});

function handleUndo() {
  if (!safePromptState.activeElement || !safePromptState.originalPrompt) {
    return;
  }

  clearTimeout(typingTimer);

  isSafePromptUpdating = true;

  setTextToElement(
    safePromptState.activeElement,
    safePromptState.originalPrompt,
  );

  setTimeout(() => {
    isSafePromptUpdating = false;
  }, 0);

  removeExistingWarning();
}

function handleReport() {
  showProtectionReport(safePromptState.activeElement, safePromptState, {
    onBack: () => {
      showProtectionConfirmation(
        safePromptState.activeElement,
        safePromptState,
        {
          onReport: handleReport,
          onUndo: handleUndo,
        },
      );
    },

    onUndo: handleUndo,
  });
}
