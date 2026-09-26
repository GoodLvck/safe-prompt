export function detectRegexEntities(text) {
  const patterns = [
    {
      type: "email",
      label: "Email",
      prefix: "EMAIL",
      regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
    },

    {
      type: "phone",
      label: "Phone number",
      prefix: "PHONE",
      regex: /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g
    },

    {
      type: "ssn",
      label: "Social Security Number",
      prefix: "SSN",
      regex: /\b\d{3}-\d{2}-\d{4}\b/g
    },

    {
      type: "creditCard",
      label: "Credit card",
      prefix: "CARD",
      regex: /\b(?:\d[ -]*?){13,19}\b/g
    },

    {
      type: "money",
      label: "Money",
      prefix: "MONEY",
      regex: /\$\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\$\s?\d+(?:\.\d{2})?/g
    }
  ];

  const detected = [];

  for (const pattern of patterns) {
    // matchAll gives us both the value and its position.
    const matches = text.matchAll(pattern.regex);

    for (const match of matches) {
      detected.push({
        type: pattern.type,
        label: pattern.label,
        prefix: pattern.prefix,

        value: match[0],

        start: match.index,
        end: match.index + match[0].length,

        source: "regex"
      });
    }
  }

  // Return entities in the same order they appear in the prompt.
  return detected.sort((a, b) => a.start - b.start);
}