import { GoogleGenAI } from "@google/genai";
import { GEMINI_API_KEY } from "../config.js";

const USE_MOCK_AI = false;

const ai = new GoogleGenAI({
  apiKey: GEMINI_API_KEY,
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
            type: "string",
          },

          action: {
            type: "string",
            enum: ["KEEP", "REPLACE", "GENERALIZE", "REMOVE"],
          },

          replacementType: {
            type: ["string", "null"],
            enum: ["semantic", "fictional", "generalized", null],
          },

          reason: {
            type: "string",
          },
        },

        required: ["token", "action", "replacementType", "reason"],
      },
    },
  },

  required: ["decisions"],
};

function buildAnalysisPrompt(tokenizedPrompt) {
  return `
You are the privacy decision engine for SafePrompt.

The user's private values have already been detected and replaced locally
with placeholders such as:

[PERSON_1]
[ORG_1]
[EMAIL_1]
[PHONE_1]
[LOCATION_1]
[MONEY_1]
[SSN_1]
[CARD_1]

You never know the original private values.

Your task is to decide, for EVERY placeholder in the prompt, how much
information must be preserved in order to fulfill the user's actual request
without unnecessarily exposing personal information.

Choose exactly one action for each placeholder:

KEEP
Use KEEP only when the exact original identity or exact original value is
necessary to answer the user's request correctly.

If replacing the real value with a different value would materially change
the answer, use KEEP.

Examples:
"What reviews does [ORG_1] have?"
→ KEEP [ORG_1]

"Compare tuition at [ORG_1] and [ORG_2]."
→ KEEP both organizations

"What are the best restaurants in [LOCATION_1]?"
→ KEEP [LOCATION_1]


REPLACE
Use REPLACE only when the user's requested output actually needs some value
of this type to remain present, but the real identity or value is not needed.

Use "semantic" when the role or category is enough.

Examples:
"I study at [ORG_1]. Help me write an email asking for an extension."
→ REPLACE [ORG_1] with replacementType "semantic"

"I work at [ORG_1]. Help me write a generic request for a promotion."
→ REPLACE [ORG_1] with replacementType "semantic"

Use "fictional" when the requested output needs a concrete name, address,
organization, email, phone number, or other explicit value, but it does not
need to be the real one.

Examples:
"Please include [EMAIL_1] in the sample email signature."
→ REPLACE [EMAIL_1] with replacementType "fictional"

"Write the sample letter and sign it as [PERSON_1]."
→ REPLACE [PERSON_1] with replacementType "fictional"

"Create a sample letter that mentions [ORG_1] by name."
→ REPLACE [ORG_1] with replacementType "fictional"

Important:
Do NOT use REPLACE merely because that type of information could normally
appear in the generated document.

For example:
"My email is [EMAIL_1]. Help me write a resignation letter."
→ REMOVE [EMAIL_1]

The user did not ask for an email address to appear in the resignation letter,
so replacing it with a fictional email would preserve unnecessary information.


GENERALIZE
Use GENERALIZE when the information is relevant to the user's request, but
the exact precision is unnecessary.

Examples:
"I earn [MONEY_1]. Help me negotiate a raise."
→ GENERALIZE [MONEY_1]

The salary matters, but an approximate amount may preserve the intent without
sharing the exact number.


REMOVE
Use REMOVE when the information is not necessary to fulfill the user's
explicit request.

If removing the value entirely would still allow an equally useful answer,
prefer REMOVE over REPLACE.

Examples:
"My email is [EMAIL_1]. Help me write a resignation letter."
→ REMOVE [EMAIL_1]

"My phone number is [PHONE_1]. Help me write a complaint."
→ REMOVE [PHONE_1]

"My name is [PERSON_1]. Help me negotiate a raise."
→ REMOVE [PERSON_1], unless the requested output explicitly needs a name.


PRIVACY PRIORITY

When more than one action could work, prefer the action that exposes the least
personal information while preserving the user's objective:

1. REMOVE if the information is unnecessary.
2. GENERALIZE if approximate information is sufficient.
3. REPLACE if some value or role must remain, but the real value is unnecessary.
4. KEEP only when the exact real value is genuinely required.

Additional rules:

- Preserve the user's original objective.
- Analyze every placeholder exactly once.
- Never attempt to infer, reconstruct, or guess the original private values.
- Never assume a value is needed merely because it commonly appears in that
  kind of document.
- Base the decision on what the user explicitly needs for the requested task.
- If a token is itself the subject of a factual question, KEEP it.
- If the role matters but the identity does not, REPLACE it.
- If only approximate magnitude matters, GENERALIZE it.
- If it has no meaningful effect on the answer, REMOVE it.
- Return decisions only for placeholders that actually appear in the prompt.

TOKENIZED PROMPT:

${tokenizedPrompt}
`;
}

function validateDecisions(tokenizedPrompt, decisions) {
  const tokens = tokenizedPrompt.match(/\[[A-Z]+_\d+\]/g) || [];

  const uniqueTokens = [...new Set(tokens)];

  const returnedTokens = decisions.map((decision) => decision.token);

  return uniqueTokens.every((token) => returnedTokens.includes(token));
}

export async function analyzeTokenizedPrompt(tokenizedPrompt) {
  if (USE_MOCK_AI) {
    return mockAnalysis(tokenizedPrompt);
  }

  const interaction = await ai.interactions.create({
    model: "gemini-3.8-flash",

    input: buildAnalysisPrompt(tokenizedPrompt),

    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: decisionSchema,
    },
  });

  const result = JSON.parse(interaction.output_text);

  if (!validateDecisions(tokenizedPrompt, result.decisions)) {
    throw new Error("Gemini did not analyze every token.");
  }

  return result;
}

function mockAnalysis(tokenizedPrompt) {
  const tokens = tokenizedPrompt.match(/\[[A-Z]+_\d+\]/g) || [];

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
          lowerPrompt.includes(`reviews does ${lowerToken}`) ||
          lowerPrompt.includes(`reviews of ${lowerToken}`) ||
          lowerPrompt.includes(`tell me about ${lowerToken}`) ||
          lowerPrompt.includes(`information about ${lowerToken}`) ||
          lowerPrompt.includes(`where is ${lowerToken}`) ||
          lowerPrompt.includes(`compare ${lowerToken}`) ||
          lowerPrompt.includes(`tuition at ${lowerToken}`) ||
          lowerPrompt.includes(`price of ${lowerToken}`);

        if (exactOrgIsSubject) {
          return {
            token,
            action: "KEEP",
            replacementType: null,
            reason:
              "Mock decision: the exact organization is the subject of the request.",
          };
        }

        const organizationNameNeeded =
          lowerPrompt.includes("mention the university by name") ||
          lowerPrompt.includes("mention the company by name") ||
          lowerPrompt.includes("mention the organization by name") ||
          lowerPrompt.includes("include the university name") ||
          lowerPrompt.includes("include the company name") ||
          lowerPrompt.includes("include the organization name") ||
          lowerPrompt.includes("use a university name") ||
          lowerPrompt.includes("use a company name") ||
          lowerPrompt.includes("use an organization name");

        if (organizationNameNeeded) {
          return {
            token,
            action: "REPLACE",
            replacementType: "fictional",
            reason:
              "Mock decision: a named organization is useful in the output, but the real identity is unnecessary.",
          };
        }

        return {
          token,
          action: "REPLACE",
          replacementType: "semantic",
          reason:
            "Mock decision: the organization role matters, but the exact identity is unnecessary.",
        };
      }

      // -----------------------------
      // PERSONS
      // -----------------------------
      if (token.startsWith("[PERSON_")) {
        const exactPersonIsSubject =
          lowerPrompt.includes(`who is ${lowerToken}`) ||
          lowerPrompt.includes(`tell me about ${lowerToken}`) ||
          lowerPrompt.includes(`information about ${lowerToken}`);

        if (exactPersonIsSubject) {
          return {
            token,
            action: "KEEP",
            replacementType: null,
            reason:
              "Mock decision: the exact person is the subject of the request.",
          };
        }

        const personNameNeeded =
          lowerPrompt.includes("include my name") ||
          lowerPrompt.includes("sign it as") ||
          lowerPrompt.includes("mention my name") ||
          lowerPrompt.includes("use my name");

        if (personNameNeeded) {
          return {
            token,
            action: "REPLACE",
            replacementType: "fictional",
            reason:
              "Mock decision: a personal name is useful in the output, but the real identity is unnecessary.",
          };
        }

        return {
          token,
          action: "REPLACE",
          replacementType: "fictional",
          reason: "Mock decision: the exact identity is not necessary.",
        };
      }

      // -----------------------------
      // LOCATIONS
      // -----------------------------
      if (token.startsWith("[LOCATION_")) {
        const exactLocationIsSubject =
          lowerPrompt.includes(`weather in ${lowerToken}`) ||
          lowerPrompt.includes(`restaurants in ${lowerToken}`) ||
          lowerPrompt.includes(`where is ${lowerToken}`) ||
          lowerPrompt.includes(`things to do in ${lowerToken}`);

        if (exactLocationIsSubject) {
          return {
            token,
            action: "KEEP",
            replacementType: null,
            reason:
              "Mock decision: the exact location is necessary to answer the request correctly.",
          };
        }

        return {
          token,
          action: "REPLACE",
          replacementType: "semantic",
          reason:
            "Mock decision: the location context matters, but the exact place is not necessary.",
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
            "Mock decision: the approximate amount preserves useful context without exposing the exact value.",
        };
      }

      // -----------------------------
      // EMAIL
      // -----------------------------
      if (token.startsWith("[EMAIL_")) {
        const exactEmailNeeded =
          lowerPrompt.includes(`send it to ${lowerToken}`) ||
          lowerPrompt.includes(`include ${lowerToken}`) ||
          lowerPrompt.includes(`use ${lowerToken}`);

        if (exactEmailNeeded) {
          return {
            token,
            action: "REPLACE",
            replacementType: "fictional",
            reason:
              "Mock decision: an email value is needed in the output, but the real address is not necessary.",
          };
        }

        return {
          token,
          action: "REMOVE",
          replacementType: null,
          reason:
            "Mock decision: the email address is unnecessary for the requested task.",
        };
      }

      // -----------------------------
      // PHONE
      // -----------------------------
      if (token.startsWith("[PHONE_")) {
        const phoneNeeded =
          lowerPrompt.includes(`call me at ${lowerToken}`) ||
          lowerPrompt.includes(`include ${lowerToken}`) ||
          lowerPrompt.includes(`use ${lowerToken}`);

        if (phoneNeeded) {
          return {
            token,
            action: "REPLACE",
            replacementType: "fictional",
            reason:
              "Mock decision: a phone number is needed in the output, but the real number is not necessary.",
          };
        }

        return {
          token,
          action: "REMOVE",
          replacementType: null,
          reason: "Mock decision: the phone number is unnecessary.",
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
            "Mock decision: the Social Security Number is unnecessary and highly sensitive.",
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
            "Mock decision: the credit card number is unnecessary and highly sensitive.",
        };
      }

      // -----------------------------
      // FALLBACK
      // -----------------------------
      return {
        token,
        action: "KEEP",
        replacementType: null,
        reason: "Mock decision: preserve the original value.",
      };
    }),
  };
}
