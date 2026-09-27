export function transformPrompt(
  tokenizedPrompt,
  decisions,
  privateMap
) {
  let result = tokenizedPrompt;

  const report = [];
  const replacementMap = {};

  for (const decision of decisions) {
    const token = decision.token;
    const privateItem = privateMap[token];

    if (!privateItem) {
      continue;
    }

    const originalValue =
      privateItem.originalValue;

    switch (decision.action) {

      // -----------------------------
      // KEEP
      // -----------------------------
      case "KEEP": {
        result = result.replaceAll(
          token,
          originalValue
        );

        report.push({
          token,
          action: "KEEP",
          originalValue,
          replacementValue: originalValue,
          reason: decision.reason
        });

        break;
      }


      // -----------------------------
      // REMOVE
      // -----------------------------
      case "REMOVE": {
        const before = result;

        result = removeTokenSentence(
          result,
          token
        );

        // Si no hemos podido eliminar
        // una frase completa,
        // eliminamos solo el token.
        if (before === result) {
          result = result.replaceAll(
            token,
            ""
          );
        }

        report.push({
          token,
          action: "REMOVE",
          originalValue,
          replacementValue: null,
          reason: decision.reason
        });

        break;
      }


      // -----------------------------
      // REPLACE
      // -----------------------------
      case "REPLACE": {
        const replacement =
          createReplacement(
            privateItem,
            decision,
            result,
            token
          );

        result = result.replaceAll(
          token,
          replacement
        );

        // Guardamos por TOKEN,
        // no por replacement.
        replacementMap[token] = {
          originalValue,
          replacementValue: replacement
        };

        report.push({
          token,
          action: "REPLACE",
          originalValue,
          replacementValue: replacement,
          reason: decision.reason
        });

        break;
      }


      // -----------------------------
      // GENERALIZE
      // -----------------------------
      case "GENERALIZE": {
        const generalized =
          generalizeValue(
            privateItem
          );

        result = result.replaceAll(
          token,
          generalized
        );

        report.push({
          token,
          action: "GENERALIZE",
          originalValue,
          replacementValue: generalized,
          reason: decision.reason
        });

        break;
      }


      // -----------------------------
      // FALLBACK
      // -----------------------------
      default: {
        // Si llega una acción desconocida,
        // preferimos KEEP para no romper
        // el significado del prompt.
        result = result.replaceAll(
          token,
          originalValue
        );

        report.push({
          token,
          action: "KEEP",
          originalValue,
          replacementValue: originalValue,
          reason:
            "Fallback: unknown privacy action."
        });
      }
    }
  }

  return {
    protectedPrompt:
      cleanPrompt(result),

    report,

    replacementMap
  };
}


// --------------------------------------------------
// REPLACEMENTS
// --------------------------------------------------

function createReplacement(
  privateItem,
  decision,
  text,
  token
) {
  if (
    decision.replacementType === "fictional"
  ) {
    return createFictionalReplacement(
      privateItem,
      text,
      token
    );
  }

  return createSemanticReplacement(
    privateItem,
    text,
    token
  );
}

function createSemanticReplacement(
  privateItem,
  text,
  token
) {
  const context = getTokenContext(
    text,
    token
  ).toLowerCase();

  switch (privateItem.type) {

    case "person":
      return "the person";

    case "organization": {
      if (
        /\b(study|studying|student|university|college|school|class|course)\b/
          .test(context)
      ) {
        return "my university";
      }

      if (
        /\b(work|working|job|employee|employer|salary|boss)\b/
          .test(context)
      ) {
        return "my employer";
      }

      if (
        /\b(hospital|doctor|patient|treated|clinic|medical)\b/
          .test(context)
      ) {
        return "my healthcare provider";
      }

      return "my organization";
    }

    case "location": {
      if (
        /\b(city|live|living|town|restaurants|local)\b/
          .test(context)
      ) {
        return "my city";
      }

      if (
        /\b(country|nationality|abroad|international)\b/
          .test(context)
      ) {
        return "my country";
      }

      return "my location";
    }

    case "email":
      return "my email address";

    case "phone":
      return "my phone number";

    default:
      return `[${privateItem.type.toUpperCase()}]`;
  }
}

function getTokenContext(
  text,
  token
) {
  const index = text.indexOf(token);

  if (index === -1) {
    return text;
  }

  const contextRadius = 80;

  const start = Math.max(
    0,
    index - contextRadius
  );

  const end = Math.min(
    text.length,
    index + token.length + contextRadius
  );

  return text.slice(
    start,
    end
  );
}

function createFictionalReplacement(
  privateItem,
  text,
  token
) {
  const context = getTokenContext(
    text,
    token
  ).toLowerCase();

  switch (privateItem.type) {

    case "person":
      return "Jordan Lee";

    case "organization": {
      if (
        /\b(study|student|university|college|school|class|course)\b/
          .test(context)
      ) {
        return "Northbridge University";
      }

      if (
        /\b(work|job|employee|employer|company|salary|boss)\b/
          .test(context)
      ) {
        return "BrightPath Technologies";
      }

      if (
        /\b(hospital|doctor|patient|clinic|medical|treated)\b/
          .test(context)
      ) {
        return "Riverside Medical Center";
      }

      if (
        /\b(bank|account|loan|mortgage|finance)\b/
          .test(context)
      ) {
        return "Summit Bank";
      }

      return "Example Organization";
    }

    case "location": {
      if (
        /\b(country|nationality|abroad|international)\b/
          .test(context)
      ) {
        return "Exampleland";
      }

      return "Springfield";
    }

    case "email":
      return "jordan.lee@example.com";

    case "phone":
      return "555-0100";

    default:
      return `[${privateItem.type.toUpperCase()}]`;
  }
}


// --------------------------------------------------
// GENERALIZATION
// --------------------------------------------------

function generalizeValue(
  privateItem
) {
  if (privateItem.type === "money") {
    return generalizeMoney(
      privateItem.originalValue
    );
  }

  return `[${privateItem.type.toUpperCase()}]`;
}


function generalizeMoney(value) {
  const number = Number(
    value.replace(/[$,]/g, "")
  );

  if (Number.isNaN(number)) {
    return "an approximate amount";
  }

  let rounded;

  if (number < 1000) {
    rounded =
      Math.round(
        number / 100
      ) * 100;
  }

  else if (number < 10000) {
    rounded =
      Math.round(
        number / 500
      ) * 500;
  }

  else {
    rounded =
      Math.round(
        number / 5000
      ) * 5000;
  }

  return `about $${rounded.toLocaleString(
    "en-US"
  )}`;
}


// --------------------------------------------------
// REMOVE ENTIRE SENTENCES
// --------------------------------------------------

function removeTokenSentence(text, token) {
  const sentences = text.split(/(?<=[.!?])\s+/);

  return sentences
    .filter((sentence) => {
      if (!sentence.includes(token)) {
        return true;
      }

      return !isSentenceOnlyAboutPrivateValue(
        sentence,
        token
      );
    })
    .map((sentence) => {
      return removeTokenFromSentence(
        sentence,
        token
      );
    })
    .filter(Boolean)
    .join(" ");
}

function isSentenceOnlyAboutPrivateValue(
  sentence,
  token
) {
  const escapedToken =
    escapeRegExp(token);

  const patterns = [
    // My email is [EMAIL_1].
    new RegExp(
      `^my\\s+.+?\\s+is\\s+${escapedToken}[.!?]?$`,
      "i"
    ),

    // My salary is [MONEY_1].
    new RegExp(
      `^my\\s+.+?\\s+is\\s+${escapedToken}[.!?]?$`,
      "i"
    ),

    // I earn [MONEY_1].
    new RegExp(
      `^i\\s+(earn|make)\\s+${escapedToken}[.!?]?$`,
      "i"
    ),

    // I live in [LOCATION_1].
    new RegExp(
      `^i\\s+live\\s+in\\s+${escapedToken}[.!?]?$`,
      "i"
    ),

    // I work at [ORG_1].
    new RegExp(
      `^i\\s+work\\s+at\\s+${escapedToken}[.!?]?$`,
      "i"
    ),

    // I study at [ORG_1].
    new RegExp(
      `^i\\s+study\\s+at\\s+${escapedToken}[.!?]?$`,
      "i"
    ),

    // My name is [PERSON_1].
    new RegExp(
      `^my\\s+name\\s+is\\s+${escapedToken}[.!?]?$`,
      "i"
    )
  ];

  return patterns.some(
    (pattern) =>
      pattern.test(sentence.trim())
  );
}

function removePrivateClause(
  sentence,
  token
) {
  const escapedToken =
    escapeRegExp(token);

  const patterns = [
    // I work at [ORG_1] and manage a small team.
    {
      regex: new RegExp(
        `^I\\s+work\\s+at\\s+${escapedToken}\\s+and\\s+`,
        "i"
      ),
      replacement: "I "
    },

    // I live in [LOCATION_1] but work remotely.
    {
      regex: new RegExp(
        `^I\\s+live\\s+in\\s+${escapedToken}\\s+but\\s+`,
        "i"
      ),
      replacement: "I "
    }
  ];

  for (const {
    regex,
    replacement
  } of patterns) {
    if (regex.test(sentence)) {
      return sentence.replace(
        regex,
        replacement
      );
    }
  }

  return sentence;
}

function removeTokenFromSentence(
  sentence,
  token
) {
  // First try removing a whole clause
  let result =
    removePrivateClause(
      sentence,
      token
    );

  // If a clause was successfully removed,
  // return the cleaned sentence immediately.
  if (result !== sentence) {
    return result
      .replace(/\s+([,.!?;:])/g, "$1")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  const escapedToken =
    escapeRegExp(token);

  result = sentence;

  const tokenEnd =
    `(?=\\s|[,.!?;:]|$)`;

  const contextualPatterns = [
    new RegExp(
      `\\bto\\s+${escapedToken}${tokenEnd}`,
      "gi"
    ),

    new RegExp(
      `\\bat\\s+${escapedToken}${tokenEnd}`,
      "gi"
    ),

    new RegExp(
      `\\bin\\s+${escapedToken}${tokenEnd}`,
      "gi"
    ),

    new RegExp(
      `\\bfrom\\s+${escapedToken}${tokenEnd}`,
      "gi"
    ),

    new RegExp(
      `\\bwith\\s+${escapedToken}${tokenEnd}`,
      "gi"
    ),

    new RegExp(
      `\\bfor\\s+${escapedToken}${tokenEnd}`,
      "gi"
    )
  ];

  for (const pattern of contextualPatterns) {
    result = result.replace(
      pattern,
      ""
    );
  }

  result = result
    .replaceAll(token, "")
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();

  return result;
}

function escapeRegExp(value) {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

// --------------------------------------------------
// CLEAN FINAL PROMPT
// --------------------------------------------------

function cleanPrompt(text) {
  return text
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/\b(and|or)\s+([,.!?])/gi, "$2")
    .replace(/\b(at|to|from|with|for|in)\s*([,.!?])/gi, "$2")
    .replace(/([.!?])\1+/g, "$1")
    .replace(/^[ \t]+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\n[ \t]+\n/g, "\n\n")
    .trim();
}
