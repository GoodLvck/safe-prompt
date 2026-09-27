import { pipeline, env } from "@huggingface/transformers";

env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL("wasm/");

let nerPipeline = null;

export async function getNERPipeline() {
  if (!nerPipeline) {
    nerPipeline = await pipeline(
      "token-classification",
      "Xenova/bert-base-NER",
    );
  }

  return nerPipeline;
}

export async function detectNamedEntities(text) {
  const ner = await getNERPipeline();

  const results = await ner(text, {
    aggregation_strategy: "simple",
  });

  return results
    .map((entity) => {
      const type = normalizeEntityType(entity.entity_group);

      if (!type) return null;

      return {
        type,
        label: getEntityLabel(type),

        value: entity.word,

        start: entity.start,
        end: entity.end,

        confidence: entity.score,

        source: "ner",
      };
    })
    .filter(Boolean);
}

function normalizeEntityType(entityGroup) {
  switch (entityGroup) {
    case "PER":
      return "person";

    case "ORG":
      return "organization";

    case "LOC":
      return "location";

    case "MISC":
      return null;

    default:
      return null;
  }
}

function getEntityLabel(type) {
  switch (type) {
    case "person":
      return "Person";

    case "organization":
      return "Organization";

    case "location":
      return "Location";

    default:
      return type;
  }
}
