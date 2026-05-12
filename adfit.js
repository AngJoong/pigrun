const KAKAO_ADFIT_SCRIPT_SRC = "https://t1.kakaocdn.net/kas/static/ba.min.js";
const DESKTOP_AD_MIN_WIDTH = 728;
const RECTANGLE_AD_MIN_WIDTH = 300;
const KAKAO_ADFIT_UNITS = {
  desktop: {
    height: "90",
    unit: "DAN-UZ0VyY6u64YsKmMn",
    width: "728",
  },
  rectangle: {
    height: "250",
    unit: "DAN-rWHu8GKMJuI1lweK",
    width: "300",
  },
  mobile: {
    height: "50",
    unit: "DAN-MPx8onlVDAQHZ7Gz",
    width: "320",
  },
};

const adfitAnchor = document.querySelector("#adfitAnchor");
let activeAdfitUnit = "";
let adfitScript = null;

function currentAdfitUnit() {
  const width = adfitAnchor?.getBoundingClientRect().width || window.innerWidth;
  if (width >= DESKTOP_AD_MIN_WIDTH) return KAKAO_ADFIT_UNITS.desktop;
  if (width >= RECTANGLE_AD_MIN_WIDTH) return KAKAO_ADFIT_UNITS.rectangle;
  return KAKAO_ADFIT_UNITS.mobile;
}

function loadAdfitScript() {
  if (adfitScript) adfitScript.remove();
  adfitScript = document.createElement("script");
  adfitScript.async = true;
  adfitScript.src = KAKAO_ADFIT_SCRIPT_SRC;
  adfitScript.type = "text/javascript";
  document.body.append(adfitScript);
}

function renderAdfitBanner() {
  if (!adfitAnchor) return;
  const adUnit = currentAdfitUnit();
  adfitAnchor.style.setProperty("--adfit-height", `${adUnit.height}px`);
  adfitAnchor.style.setProperty("--adfit-width", `${adUnit.width}px`);

  if (!adUnit.unit) {
    adfitAnchor.hidden = true;
    adfitAnchor.innerHTML = "";
    return;
  }

  adfitAnchor.hidden = false;
  if (adUnit.unit === activeAdfitUnit) return;
  activeAdfitUnit = adUnit.unit;
  adfitAnchor.innerHTML = "";

  const frame = document.createElement("div");
  frame.className = "adfit-frame";

  const ins = document.createElement("ins");
  ins.className = "kakao_ad_area";
  ins.dataset.adHeight = adUnit.height;
  ins.dataset.adUnit = adUnit.unit;
  ins.dataset.adWidth = adUnit.width;
  ins.style.display = "none";

  frame.append(ins);
  adfitAnchor.append(frame);
  loadAdfitScript();
}

renderAdfitBanner();

if (adfitAnchor && "ResizeObserver" in window) {
  const observer = new ResizeObserver(renderAdfitBanner);
  observer.observe(adfitAnchor);
} else {
  window.addEventListener("resize", renderAdfitBanner);
}
