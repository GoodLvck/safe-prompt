export const safePromptState = {
  originalPrompt: "",
  tokenizedPrompt: "",

  detectedItems: [],
  privateMap: {},

  aiDecisions: [],
  protectedPrompt: "",

  decisions: {},
  replacementMap: {},
  report: [],

  activeElement: null,
};

export function resetState() {
  safePromptState.originalPrompt = "";
  safePromptState.tokenizedPrompt = "";

  safePromptState.detectedItems = [];
  safePromptState.privateMap = {};

  safePromptState.aiDecisions = [];
  safePromptState.protectedPrompt = "";

  safePromptState.decisions = {};
  safePromptState.replacementMap = {};
  safePromptState.report = [];

  safePromptState.activeElement = null;
}
