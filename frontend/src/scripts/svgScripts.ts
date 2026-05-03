function fillSvg(svg?: HTMLSpanElement, eID?: string) {
  // If both parameters are missing, log error and return
  if (!svg && !eID) return console.error("The SVG and eID is null");

  let eSVG: HTMLElement | null = null;

  // Search by ID if eID is provided
  if (eID && eID !== "") {
    const e = document.getElementById(eID);
    if (!e) return console.error("Element does not exist, or has no id.");

    // Select the specific element with ID #googleSymbol inside the parent
    eSVG = e.querySelector("#googleSymbol") as HTMLElement;
  }
  // Otherwise, use the directly passed SVG element
  else if (svg) {
    eSVG = svg;
  }

  // Final validation
  if (!eSVG) return console.error("eSVG is null");

  // Logic: Add or remove class based on existence
  if (eSVG.classList.contains("icon-fill")) {
    eSVG.classList.remove("icon-fill");
  } else {
    eSVG.classList.add("icon-fill");
  }
}

// Make the function globally accessible
(window as any).fillSvg = fillSvg;
