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

    const originalValue = privateItem.originalValue;

    switch (decision.action) {
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

      case "REMOVE": {
        const before = result;

        result = removeTokenSentence(
          result,
          token
        );

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

      case "REPLACE": {
        const replacement =
          createReplacement(privateItem);

        result = result.replaceAll(
          token,
          replacement
        );

        replacementMap[replacement] =
          originalValue;

        report.push({
          token,
          action: "REPLACE",
          originalValue,
          replacementValue: replacement,
          reason: decision.reason
        });

        break;
      }

      case "GENERALIZE": {
        const generalized =
          generalizeValue(privateItem);

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
    }
  }

  return {
    protectedPrompt: cleanPrompt(result),
    report,
    replacementMap
  };
}

function removeTokenSentence(text, token) {
  const sentences = text.split(/(?<=[.!?])\s+/);

  const removablePatterns = [
    /^my email is /i,
    /^my phone is /i,
    /^my ssn is /i,
    /^my social security number is /i,
    /^my card number is /i
  ];

  return sentences
    .filter((sentence) => {
      if (!sentence.includes(token)) {
        return true;
      }

      return !removablePatterns.some((pattern) =>
        pattern.test(sentence)
      );
    })
    .join(" ");
}

function createReplacement(privateItem) {
  switch (privateItem.type) {
    case "person":
      return "Alex";

    case "organization":
      return "Example University";

    case "location":
      return "my city";

    case "email":
      return "alex@example.com";

    case "phone":
      return "555-0100";

    default:
      return `[${privateItem.type.toUpperCase()}]`;
  }
}

function generalizeValue(privateItem) {
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
      Math.round(number / 100) * 100;
  }

  else if (number < 10000) {
    rounded =
      Math.round(number / 500) * 500;
  }

  else {
    rounded =
      Math.round(number / 5000) * 5000;
  }

  return `about $${rounded.toLocaleString("en-US")}`;
}

function cleanPrompt(text) {
  return text
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
