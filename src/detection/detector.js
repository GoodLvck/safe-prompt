import {
  detectRegexEntities
} from "./regexDetector.js";

import {
  detectNamedEntities
} from "./nerDetector.js";

export async function detectSensitiveEntities(text) {
  const regexEntities =
    detectRegexEntities(text);

  const nerEntities =
    await detectNamedEntities(text);

  const allEntities = [
    ...regexEntities,
    ...nerEntities
  ];

  return removeOverlaps(allEntities);
}

function removeOverlaps(entities) {
  /*
   * Prefer regex entities when two detections overlap.
   *
   * Example:
   * email / phone / money detected by regex
   * should generally be more reliable than a generic
   * NER classification.
   */

  const sorted = [...entities].sort((a, b) => {
    // Regex first
    if (
      a.source === "regex" &&
      b.source !== "regex"
    ) {
      return -1;
    }

    if (
      b.source === "regex" &&
      a.source !== "regex"
    ) {
      return 1;
    }

    // If same source, prefer longest entity
    const lengthA =
      (a.end ?? 0) - (a.start ?? 0);

    const lengthB =
      (b.end ?? 0) - (b.start ?? 0);

    return lengthB - lengthA;
  });

  const accepted = [];

  for (const entity of sorted) {
    const overlaps =
      accepted.some((existing) => {
        if (
          entity.start == null ||
          entity.end == null ||
          existing.start == null ||
          existing.end == null
        ) {
          return false;
        }

        return (
          entity.start < existing.end &&
          entity.end > existing.start
        );
      });

    if (!overlaps) {
      accepted.push(entity);
    }
  }

  // Return in prompt order
  return accepted.sort(
    (a, b) =>
      (a.start ?? 0) -
      (b.start ?? 0)
  );
}