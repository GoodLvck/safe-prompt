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
            decision
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
  decision
) {
  const replacementType =
    decision.replacementType;

  // Si el Decision Engine pide
  // un replacement ficticio
  if (
    replacementType === "fictional"
  ) {
    return createFictionalReplacement(
      privateItem
    );
  }

  // Por defecto usamos una
  // sustitución semántica.
  return createSemanticReplacement(
    privateItem
  );
}


function createSemanticReplacement(
  privateItem
) {
  switch (privateItem.type) {

    case "person":
      return "the person";

    case "organization":
      return "my organization";

    case "location":
      return "my location";

    case "email":
      return "my email address";

    case "phone":
      return "my phone number";

    default:
      return `[${privateItem.type.toUpperCase()}]`;
  }
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
