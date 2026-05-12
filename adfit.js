const KAKAO_ADFIT_SCRIPT_SRC = "https://t1.kakaocdn.net/kas/static/ba.min.js";
const DESKTOP_AD_MIN_WIDTH = 728;
const KAKAO_ADFIT_UNITS = {
  desktop: {
    height: "90",
    unit: "DAN-i52lOpIZtyJYWndG",
    width: "728",
  },
  mobile: {
    height: "50",
    unit: "DAN-ipLRVguTmHqe1KL5",
    width: "320",
  },
};

const adfitAnchor = document.querySelector("#adfitAnchor");
let activeAdfitUnit = "";
let adfitScript = null;

function currentAdfitUnit() {
  const width = adfitAnchor?.getBoundingClientRect().width || window.innerWidth;
  return width >= DESKTOP_AD_MIN_WIDTH ? KAKAO_ADFIT_UNITS.desktop : KAKAO_ADFIT_UNITS.mobile;
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
  if (adUnit.unit === activeAdfitUnit) return;
  activeAdfitUnit = adUnit.unit;

  adfitAnchor.style.setProperty("--adfit-height", `${adUnit.height}px`);
  adfitAnchor.style.setProperty("--adfit-width", `${adUnit.width}px`);
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
