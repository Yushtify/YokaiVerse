function fillSvg(svg: HTMLSpanElement, eID: string) {
  // if any invalid return
  if (!svg && !eID) return console.error("The SVG and eID is null");
  let eSVG: HTMLSpanElement;
  let e: HTMLElement;

  // if the svg returned anything but span element or invalid and eID is valid
  if (eID) {
    e = document.getElementById(eID) as HTMLElement;
    if (!e) return console.error("Element does not exist, or has no id.");

    eSVG = e.querySelector("#googleSymbol") as HTMLSpanElement;
  } else eSVG = svg;

  // everything should be fine continue to function.
  if (!eSVG) return console.error("eSVG is null");
  if (eSVG.classList.contains("icon-fill")) {
    eSVG.classList.remove("icon-fill");
  } else {
    eSVG.classList.add("icon-fill");
  }
}
(window as any).fillSvg = fillSvg;
