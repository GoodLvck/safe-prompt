function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setTextToElement(element, newText) {
  if (element.isContentEditable) {
    element.innerText = newText;
  } else {
    element.value = newText;
  }

  element.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      inputType: "insertText",
      data: newText
    })
  );

  element.focus();
}

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

export function showWarning(element, state) {
  removeExistingWarning();

  const warning = document.createElement("div");
  warning.id = "safeprompt-warning";

  const itemsHtml = state.detectedItems
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
        🔒 ${state.detectedItems.length}
        private value${state.detectedItems.length !== 1 ? "s" : ""}
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
  .addEventListener("click", () => {
    setTextToElement(
      element,
      state.tokenizedPrompt
    );

    removeExistingWarning();
  });

  document
  .getElementById("sp-review-manually")
  .addEventListener("click", () => {
    showManualReview(
      element,
      state
    );
  });
}

function showManualReview(element, state) {
  removeExistingWarning();

  const review = document.createElement("div");
  review.id = "safeprompt-warning";

  const selections = {};

  // Default: protect every detected value
  state.detectedItems.forEach((item) => {
    selections[item.token] = "protect";
  });

  const itemsHtml = state.detectedItems
    .map(
      (item, index) => `
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

            <div class="sp-review-options">

              <label>
                <input
                  type="radio"
                  name="sp-item-${index}"
                  value="protect"
                  data-token="${escapeHtml(item.token)}"
                  checked
                >
                Protect
              </label>

              <label>
                <input
                  type="radio"
                  name="sp-item-${index}"
                  value="keep"
                  data-token="${escapeHtml(item.token)}"
                >
                Keep original
              </label>

            </div>

          </div>

        </div>
      `
    )
    .join("");

  review.innerHTML = `
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

      <button id="sp-review-back">
        Back
      </button>

      <button id="sp-apply-review">
        Apply
      </button>

    </div>
  `;

  document.body.appendChild(review);

  positionWarning(
    review,
    element
  );

  document
    .getElementById("sp-close-button")
    .addEventListener(
      "click",
      removeExistingWarning
    );

  document
    .getElementById("sp-review-back")
    .addEventListener("click", () => {
      showWarning(
        element,
        state
      );
    });

  review
    .querySelectorAll(
      'input[type="radio"]'
    )
    .forEach((radio) => {

      radio.addEventListener(
        "change",
        (event) => {

          const token =
            event.target.dataset.token;

          selections[token] =
            event.target.value;
        }
      );

    });

  document
    .getElementById("sp-apply-review")
    .addEventListener("click", () => {

      let result =
        state.tokenizedPrompt;

      for (
        const item
        of state.detectedItems
      ) {

        const choice =
          selections[item.token];

        if (choice === "keep") {

          result =
            result.replaceAll(
              item.token,
              item.value
            );

        }

        // "protect" does nothing because
        // tokenizedPrompt already contains
        // the protected token.
      }

      setTextToElement(
        element,
        result
      );

      removeExistingWarning();
    });
}
