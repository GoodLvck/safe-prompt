import {
  analyzeTokenizedPrompt
} from "./ai/geminiClient.js";

chrome.runtime.onMessage.addListener(
  (message, sender, sendResponse) => {

    if (message.type !== "ANALYZE_PROMPT") {
      return;
    }

    analyzeTokenizedPrompt(
      message.tokenizedPrompt
    )
      .then(result => {
        sendResponse({
          success: true,
          result
        });
      })
      .catch(error => {
        console.error(
          "SafePrompt AI error:",
          error
        );

        sendResponse({
          success: false,
          error: error.message
        });
      });

    return true;
  }
);