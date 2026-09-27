import { setTextToElement } from "../utils/dom.js";

export function removeExistingWarning() {
  const existing =
    document.getElementById("safeprompt-warning");

  if (existing) {
    existing.remove();
  }
}

export function positionWarning(warning, element) {
  const rect = element.getBoundingClientRect();

  warning.style.top =
    `${window.scrollY + rect.top - warning.offsetHeight - 12}px`;

  warning.style.left =
    `${window.scrollX + rect.left}px`;
}

export function showWarning(
  element,
  state,
  {
    onAutoProtect,
    onReview
  }
) {
  removeExistingWarning();

  const warning = document.createElement("div");
  warning.id = "safeprompt-warning";

  const uniqueItems = [
    ...new Map(
      state.detectedItems.map(item => [
        item.token,
        item
      ])
    ).values()
  ];

  const itemsHtml = uniqueItems
    .map((item) => `
      <div class="sp-item">
        <div class="sp-item-info">
          <div class="sp-item-label">
            ${escapeHtml(item.label)}
          </div>

          <div class="sp-item-value">
            ${escapeHtml(item.value)}
          </div>

          <div class="sp-item-replacement">
            → ${escapeHtml(item.token)}
          </div>
        </div>
      </div>
    `)
    .join("");

  warning.innerHTML = `
    <div class="sp-header">
      <div>
        🔒 ${uniqueItems.length}
        private value${uniqueItems.length !== 1 ? "s" : ""}
        detected
      </div>

      <button id="sp-close-button">
        ×
      </button>
    </div>

    <div class="sp-items">
      ${itemsHtml}
    </div>

    <div class="sp-actions">
      <button id="sp-auto-protect">
        Auto Protect
      </button>

      <button id="sp-review-manually">
        Review manually
      </button>
    </div>
  `;

  document.body.appendChild(warning);

  positionWarning(warning, element);

  document
    .getElementById("sp-close-button")
    .addEventListener(
      "click",
      removeExistingWarning
    );

  document
    .getElementById("sp-auto-protect")
    .addEventListener("click", async () => {
      await onAutoProtect();
    });

  document
  .getElementById("sp-review-manually")
  .addEventListener("click", () => {
    onReview();
  });
}

export function showManualReview(
  element,
  state,
  {
    onApplyManual
  }
) {
  removeExistingWarning();

  const panel = document.createElement("div");
  panel.id = "safeprompt-warning";

  const uniqueItems = [
    ...new Map(
      state.detectedItems.map(item => [
        item.token,
        item
      ])
    ).values()
  ];

  const itemsHtml = uniqueItems
    .map((item, index) => `
      <div class="sp-item" data-index="${index}">
        <div class="sp-item-info">
          <div class="sp-item-label">
            ${item.label}
          </div>

          <div class="sp-item-value">
            ${item.value}
          </div>

          <div class="sp-item-replacement">
            ${item.token}
          </div>
        </div>

        <div class="sp-manual-options">

          <label>
            <input
              type="radio"
              name="decision-${index}"
              value="KEEP"
            >
            Keep
          </label>

          <label>
            <input
              type="radio"
              name="decision-${index}"
              value="REPLACE"
              checked
            >
            Replace
          </label>

          <label>
            <input
              type="radio"
              name="decision-${index}"
              value="GENERALIZE"
            >
            Generalize
          </label>

          <label>
            <input
              type="radio"
              name="decision-${index}"
              value="REMOVE"
            >
            Remove
          </label>

        </div>
      </div>
    `)
    .join("");

  panel.innerHTML = `
    <div class="sp-header">
      <div>
        Review private information
      </div>

      <button id="sp-close-button">
        ×
      </button>
    </div>

    <div class="sp-items">
      ${itemsHtml}
    </div>

    <div class="sp-actions">
      <button id="sp-cancel-review">
        Cancel
      </button>

      <button id="sp-apply-review">
        Apply changes
      </button>
    </div>
  `;

  document.body.appendChild(panel);

  positionWarning(panel, element);

  document
    .getElementById("sp-close-button")
    .addEventListener(
      "click",
      removeExistingWarning
    );

  document
    .getElementById("sp-cancel-review")
    .addEventListener(
      "click",
      removeExistingWarning
    );

  document
    .getElementById("sp-apply-review")
    .addEventListener(
      "click",
      () => {
        const manualDecisions =
          uniqueItems.map((item, index) => {
            const selected =
              panel.querySelector(
                `input[name="decision-${index}"]:checked`
              );

            return {
              token: item.token,
              action:
                selected?.value || "KEEP",
              replacementType:
                selected?.value === "REPLACE"
                  ? "semantic"
                  : selected?.value ===
                    "GENERALIZE"
                    ? "generalized"
                    : null,
              reason:
                "Selected manually by the user."
            };
          });

        onApplyManual(
          manualDecisions
        );
      }
    );
}

export function showProtectionConfirmation(
  element,
  state,
  {
    onReport,
    onUndo
  }
) {
  removeExistingWarning();

  const panel = document.createElement("div");
  panel.id = "safeprompt-warning";

  const changedCount =
    state.report.filter(
      item => item.action !== "KEEP"
    ).length;

  const keptCount =
    state.report.filter(
      item => item.action === "KEEP"
    ).length;

  panel.innerHTML = `
    <div class="sp-header">
      <div>
        ✓ Prompt protected
      </div>

      <button id="sp-close-button">
        ×
      </button>
    </div>

    <div class="sp-confirmation">
      <strong>${state.report.length}</strong>
      private values analyzed

      <div class="sp-confirmation-stats">
        ${changedCount} protected ·
        ${keptCount} kept
      </div>
    </div>

    <div class="sp-actions">
      <button id="sp-report-button">
        Report
      </button>

      <button id="sp-undo-button">
        Undo
      </button>
    </div>
  `;

  document.body.appendChild(panel);

  positionWarning(
    panel,
    element
  );

  document
    .getElementById("sp-close-button")
    .addEventListener(
      "click",
      removeExistingWarning
    );

  document
    .getElementById("sp-report-button")
    .addEventListener(
      "click",
      onReport
    );

  document
    .getElementById("sp-undo-button")
    .addEventListener(
      "click",
      onUndo
    );
}

export function showProtectionReport(
  element,
  state,
  {
    onBack,
    onUndo
  }
) {
  removeExistingWarning();

  const panel = document.createElement("div");
  panel.id = "safeprompt-warning";

  const reportItemsHtml = state.report
    .map((item) => {
      let replacementHtml = "";

      if (item.action === "REMOVE") {
        replacementHtml = `
          <div class="sp-report-change">
            <span>${escapeHtml(item.originalValue)}</span>
            <span>→</span>
            <strong>Removed</strong>
          </div>
        `;
      }

      else if (
        item.action === "REPLACE" ||
        item.action === "GENERALIZE"
      ) {
        replacementHtml = `
          <div class="sp-report-change">
            <span>${escapeHtml(item.originalValue)}</span>
            <span>→</span>
            <strong>
              ${escapeHtml(item.replacementValue)}
            </strong>
          </div>
        `;
      }

      else {
        replacementHtml = `
          <div class="sp-report-change">
            <span>${escapeHtml(item.originalValue)}</span>
            <span>→</span>
            <strong>Kept</strong>
          </div>
        `;
      }

      return `
        <div class="sp-report-item">

          <div class="sp-report-top">
            <span class="sp-report-type">
              ${escapeHtml(item.token)}
            </span>

            <span class="sp-report-action sp-action-${item.action.toLowerCase()}">
              ${item.action}
            </span>
          </div>

          ${replacementHtml}

          <div class="sp-report-reason">
            ${escapeHtml(item.reason || "No reason provided.")}
          </div>

        </div>
      `;
    })
    .join("");

  panel.innerHTML = `
    <div class="sp-header">
      <div>
        🔒 Protection Report
      </div>

      <button id="sp-close-button">
        ×
      </button>
    </div>

    <div class="sp-report-summary">
      ${state.report.length} private values analyzed
    </div>

    <div class="sp-report-items">
      ${reportItemsHtml}
    </div>

    <div class="sp-actions">

      <button id="sp-report-back">
        Back
      </button>

      <button id="sp-report-undo">
        Undo
      </button>

    </div>
  `;

  document.body.appendChild(panel);

  positionWarning(
    panel,
    element
  );

  document
    .getElementById("sp-close-button")
    .addEventListener(
      "click",
      removeExistingWarning
    );

  document
    .getElementById("sp-report-back")
    .addEventListener(
      "click",
      onBack
    );

  document
    .getElementById("sp-report-undo")
    .addEventListener(
      "click",
      onUndo
    );
}

function escapeHtml(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
