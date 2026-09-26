const PREFIX_MAP = {
  email: "EMAIL",
  phone: "PHONE",
  ssn: "SSN",
  creditCard: "CARD",
  money: "MONEY",
  person: "PERSON",
  organization: "ORG",
  location: "LOCATION"
};

export function tokenizePrompt(text, detectedItems) {
  const counters = {};
  const valueToToken = new Map();
  const privateMap = {};
  const items = [];

  for (const item of detectedItems) {
    const prefix =
      item.prefix ||
      PREFIX_MAP[item.type] ||
      item.type.toUpperCase();

    const key =
      `${item.type}:${normalizeValue(item.value)}`;

    let token;

    // Same real value = same token
    if (valueToToken.has(key)) {
      token = valueToToken.get(key);
    } else {
      counters[prefix] =
        (counters[prefix] || 0) + 1;

      token =
        `[${prefix}_${counters[prefix]}]`;

      valueToToken.set(key, token);

      privateMap[token] = {
        token,
        type: item.type,
        label: item.label,
        originalValue: item.value
      };
    }

    items.push({
      ...item,
      token
    });
  }

  let tokenizedText = text;

  /*
   * Replace longer values first.
   * This avoids problems if one detected entity
   * is contained inside another.
   */
  const uniqueItems = [
    ...new Map(
      items.map(item => [
        `${item.type}:${normalizeValue(item.value)}`,
        item
      ])
    ).values()
  ].sort(
    (a, b) =>
      b.value.length - a.value.length
  );

  for (const item of uniqueItems) {
    tokenizedText =
      tokenizedText.replaceAll(
        item.value,
        item.token
      );
  }

  return {
    tokenizedText,
    items,
    privateMap
  };
}

function normalizeValue(value) {
  return value
    .trim()
    .toLowerCase();
}