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
      privateItem
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
  privateItem
) {
  switch (privateItem.type) {

    case "person":
      return "Jordan";

    case "organization":
      return "Example University";

    case "location":
      return "Springfield";

    case "email":
      return "jordan@example.com";

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

function removeTokenSentence(
  text,
  token
) {
  const sentences =
    text.split(
      /(?<=[.!?])\s+/
    );

  const removablePatterns = [
    /^my email is /i,
    /^my phone is /i,
    /^my phone number is /i,
    /^my ssn is /i,
    /^my social security number is /i,
    /^my card number is /i
  ];

  return sentences
    .filter((sentence) => {

      if (
        !sentence.includes(token)
      ) {
        return true;
      }

      return !removablePatterns.some(
        (pattern) =>
          pattern.test(sentence)
      );
    })
    .join(" ");
}


// --------------------------------------------------
// CLEAN FINAL PROMPT
// --------------------------------------------------

function cleanPrompt(text) {
  return text
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
