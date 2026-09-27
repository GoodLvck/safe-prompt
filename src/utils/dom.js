export function getTextFromElement(element) {
  if (element.isContentEditable) {
    return element.innerText;
  }

  return element.value;
}

export function setTextToElement(element, newText) {
  if (element.isContentEditable) {
    element.innerText = newText;
  } else {
    element.value = newText;
  }

  element.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      inputType: "insertText",
      data: newText,
    }),
  );

  element.focus();
}
