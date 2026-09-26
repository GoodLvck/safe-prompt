export const safePromptState = {
  originalPrompt: "",
  tokenizedPrompt: "",

  detectedItems: [],
  privateMap: {},

  // Used in later phases
  decisions: {},
  replacementMap: {},

  activeElement: null
};

export function resetState() {
  safePromptState.originalPrompt = "";
  safePromptState.tokenizedPrompt = "";

  safePromptState.detectedItems = [];
  safePromptState.privateMap = {};

  safePromptState.decisions = {};
  safePromptState.replacementMap = {};

  safePromptState.activeElement = null;
}