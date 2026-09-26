import { GoogleGenAI } from "@google/genai";
import { GEMINI_API_KEY } from "../config.js";

const USE_MOCK_AI = true;

console.log(
  USE_MOCK_AI
    ? "SafePrompt running in MOCK mode"
    : "SafePrompt running with Gemini"
);

const ai = new GoogleGenAI({
  apiKey: GEMINI_API_KEY
});

const decisionSchema = {
  type: "object",

  properties: {
    decisions: {
      type: "array",

      items: {
        type: "object",

        properties: {
          token: {
            type: "string"
          },

          action: {
            type: "string",
            enum: [
              "KEEP",
              "REPLACE",
              "GENERALIZE",
              "REMOVE"
            ]
          },

          replacementType: {
            type: ["string", "null"],
            enum: [
              "semantic",
              "fictional",
              "generalized",
              null
            ]
          },

          reason: {
            type: "string"
          }
        },

        required: [
          "token",
          "action",
          "replacementType",
          "reason"
        ]
      }
    }
  },

  required: ["decisions"]
};

function buildAnalysisPrompt(tokenizedPrompt) {
  return `
You are the privacy decision engine for SafePrompt.

The user's private values have already been replaced locally
with placeholders such as:

[PERSON_1]
[ORG_1]
[EMAIL_1]
[PHONE_1]
[LOCATION_1]
[MONEY_1]

You never know the original values.

For EVERY placeholder in the prompt choose exactly one action:

KEEP
Use this only when the exact original identity or value is
required to correctly fulfill the user's request.

Example:
"What reviews does [ORG_1] have?"
The organization itself is the subject of the question,
so its real identity must be preserved.

REPLACE
Use this when the role, category or relationship matters,
but the exact identity does not.

Example:
"I study at [ORG_1]. Write an email to my professor."
The exact university is unnecessary. It could become
"my university" or a fictional university.

GENERALIZE
Use this when the information matters but exact precision
is unnecessary.

Example:
"I earn [MONEY_1]. Help me negotiate a raise."
The approximate amount may be enough.

REMOVE
Use this when the information has no meaningful effect
on fulfilling the request.

Important rules:

- Preserve the user's objective.
- Prefer privacy when exact information is unnecessary.
- Never attempt to infer or reconstruct original values.
- Analyze every placeholder exactly once.
- KEEP is allowed when changing the value would change
  the answer.
- Return decisions only for placeholders that actually
  appear in the prompt.

TOKENIZED PROMPT:

${tokenizedPrompt}
`;
}

function validateDecisions(
  tokenizedPrompt,
  decisions
) {
  const tokens =
    tokenizedPrompt.match(
      /\[[A-Z]+_\d+\]/g
    ) || [];

  const uniqueTokens =
    [...new Set(tokens)];

  const returnedTokens =
    decisions.map(
      decision => decision.token
    );

  return uniqueTokens.every(
    token =>
      returnedTokens.includes(token)
  );
}

export async function analyzeTokenizedPrompt(
  tokenizedPrompt
) {
  if (USE_MOCK_AI) {
    console.log(
      "SafePrompt MOCK AI enabled"
    );

    console.log(
      "Tokenized prompt:",
      tokenizedPrompt
    );

    return mockAnalysis(
      tokenizedPrompt
    );
  }

  // Aquí queda tu llamada REAL a Gemini

  const interaction =
    await ai.interactions.create({
      model: "gemini-3.8-flash",

      input:
        buildAnalysisPrompt(
          tokenizedPrompt
        ),

      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: decisionSchema
      }
    });

  const result =
    JSON.parse(
      interaction.output_text
    );

  if (
    !validateDecisions(
      tokenizedPrompt,
      result.decisions
    )
  ) {
    throw new Error(
      "Gemini did not analyze every token."
    );
  }

  return result;
}

function mockAnalysis(tokenizedPrompt) {
  const tokens =
    tokenizedPrompt.match(/\[[A-Z]+_\d+\]/g) || [];

  const uniqueTokens = [...new Set(tokens)];

  const lowerPrompt = tokenizedPrompt.toLowerCase();

  return {
    decisions: uniqueTokens.map((token) => {
      const lowerToken = token.toLowerCase();

      // -----------------------------
      // ORGANIZATIONS
      // -----------------------------

      if (token.startsWith("[ORG_")) {
        const exactOrgIsSubject =
          lowerPrompt.includes(
            `reviews does ${lowerToken}`
          ) ||
          lowerPrompt.includes(
            `reviews of ${lowerToken}`
          ) ||
          lowerPrompt.includes(
            `tell me about ${lowerToken}`
          ) ||
          lowerPrompt.includes(
            `information about ${lowerToken}`
          ) ||
          lowerPrompt.includes(
            `where is ${lowerToken}`
          ) ||
          lowerPrompt.includes(
            `compare ${lowerToken}`
          ) ||
          lowerPrompt.includes(
            `tuition at ${lowerToken}`
          ) ||
          lowerPrompt.includes(
            `price of ${lowerToken}`
          );

        if (exactOrgIsSubject) {
          return {
            token,
            action: "KEEP",
            replacementType: null,
            reason:
              "Mock decision: the exact organization is the subject of the request."
          };
        }

        return {
          token,
          action: "REPLACE",
          replacementType: "semantic",
          reason:
            "Mock decision: the organization context matters, but the exact identity is not necessary."
        };
      }

      // -----------------------------
      // PERSONS
      // -----------------------------

      if (token.startsWith("[PERSON_")) {
        const exactPersonIsSubject =
          lowerPrompt.includes(
            `who is ${lowerToken}`
          ) ||
          lowerPrompt.includes(
            `tell me about ${lowerToken}`
          ) ||
          lowerPrompt.includes(
            `information about ${lowerToken}`
          );

        if (exactPersonIsSubject) {
          return {
            token,
            action: "KEEP",
            replacementType: null,
            reason:
              "Mock decision: the exact person is the subject of the request."
          };
        }

        return {
          token,
          action: "REPLACE",
          replacementType: "fictional",
          reason:
            "Mock decision: the exact name is not necessary."
        };
      }

      // -----------------------------
      // LOCATIONS
      // -----------------------------

      if (token.startsWith("[LOCATION_")) {
        const exactLocationIsSubject =
          lowerPrompt.includes(
            `weather in ${lowerToken}`
          ) ||
          lowerPrompt.includes(
            `restaurants in ${lowerToken}`
          ) ||
          lowerPrompt.includes(
            `where is ${lowerToken}`
          ) ||
          lowerPrompt.includes(
            `things to do in ${lowerToken}`
          );

        if (exactLocationIsSubject) {
          return {
            token,
            action: "KEEP",
            replacementType: null,
            reason:
              "Mock decision: the exact location is necessary to answer the request correctly."
          };
        }

        return {
          token,
          action: "REPLACE",
          replacementType: "semantic",
          reason:
            "Mock decision: the location context matters, but the exact place is not necessary."
        };
      }

      // -----------------------------
      // MONEY
      // -----------------------------

      if (token.startsWith("[MONEY_")) {
        return {
          token,
          action: "GENERALIZE",
          replacementType: "generalized",
          reason:
            "Mock decision: the approximate amount preserves useful context without exposing the exact value."
        };
      }

      // -----------------------------
      // EMAIL
      // -----------------------------

      if (token.startsWith("[EMAIL_")) {
        const exactEmailNeeded =
          lowerPrompt.includes(
            `send it to ${lowerToken}`
          ) ||
          lowerPrompt.includes(
            `include ${lowerToken}`
          ) ||
          lowerPrompt.includes(
            `use ${lowerToken}`
          );

        if (exactEmailNeeded) {
          return {
            token,
            action: "REPLACE",
            replacementType: "fictional",
            reason:
              "Mock decision: an email value is needed in the output, but the real address is not necessary."
          };
        }

        return {
          token,
          action: "REMOVE",
          replacementType: null,
          reason:
            "Mock decision: the email address is unnecessary for the requested task."
        };
      }

      // -----------------------------
      // PHONE
      // -----------------------------

      if (token.startsWith("[PHONE_")) {
        const phoneNeeded =
          lowerPrompt.includes(
            `call me at ${lowerToken}`
          ) ||
          lowerPrompt.includes(
            `include ${lowerToken}`
          ) ||
          lowerPrompt.includes(
            `use ${lowerToken}`
          );

        if (phoneNeeded) {
          return {
            token,
            action: "REPLACE",
            replacementType: "fictional",
            reason:
              "Mock decision: a phone number is needed in the output, but the real number is not necessary."
          };
        }

        return {
          token,
          action: "REMOVE",
          replacementType: null,
          reason:
            "Mock decision: the phone number is unnecessary."
        };
      }

      // -----------------------------
      // SSN
      // -----------------------------

      if (token.startsWith("[SSN_")) {
        return {
          token,
          action: "REMOVE",
          replacementType: null,
          reason:
            "Mock decision: the Social Security Number should not be shared because it is not necessary."
        };
      }

      // -----------------------------
      // CREDIT CARD
      // -----------------------------

      if (token.startsWith("[CARD_")) {
        return {
          token,
          action: "REMOVE",
          replacementType: null,
          reason:
            "Mock decision: the credit card number is unnecessary and highly sensitive."
        };
      }

      // -----------------------------
      // FALLBACK
      // -----------------------------

      return {
        token,
        action: "KEEP",
        replacementType: null,
        reason:
          "Mock decision: preserve the original value."
      };
    })
  };
}
