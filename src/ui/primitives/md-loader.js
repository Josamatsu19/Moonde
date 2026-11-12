import { MorphSVGPlugin, GSDevTools } from "../../motion/gsap-registry.js";
import { MOTION_TOKENS } from "../../motion/motion-tokens.js";
import { withMotionContext } from "../../motion/motion-context.js";
import { i18n } from "../../core/i18n/i18n-service.js";

const CAPSULE_HEX_PATH = "M 60 14 L 100 36 L 100 84 L 60 106 L 20 84 L 20 36 Z";
const MOONDEX_OPTIC_LENS_PATH =
  "M 60 18 C 86 18 102 34 102 60 C 102 86 86 102 60 102 C 34 102 18 86 18 60 C 18 34 34 18 60 18 Z";

export class MdLoader extends HTMLElement {
  #motionHandle = null;

  connectedCallback() {
    this.render();
  }

  disconnectedCallback() {
    this.#motionHandle?.revert();
  }

  render() {
    this.innerHTML = `
      <div class="loader-overlay" role="status" aria-live="polite" id="loader-overlay">
        <div class="loader-shutter loader-shutter--top" data-shutter="top"></div>
        <div class="loader-shutter loader-shutter--bottom" data-shutter="bottom"></div>
        <div class="loader-core" data-loader-core>
          <svg class="loader-svg" viewBox="0 0 120 120" aria-hidden="true">
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke="rgba(34, 211, 238, 0.25)"
              stroke-width="2"
              stroke-dasharray="8 6"
            />
            <path
              id="loader-morph-core"
              d="${CAPSULE_HEX_PATH}"
              fill="rgba(34, 211, 238, 0.16)"
              stroke="#22d3ee"
              stroke-width="3.5"
            />
            <circle cx="60" cy="60" r="10" fill="#f43f5e" id="loader-inner-spark" />
          </svg>
          <p class="mono" id="loader-status-text">${i18n.t("loader.initializing")}</p>
        </div>
      </div>
    `;
  }

  playBootSequence() {
    this.#motionHandle?.revert();
    const overlay = this.querySelector("#loader-overlay");
    const core = this.querySelector("[data-loader-core]");
    const morphPath = this.querySelector("#loader-morph-core");
    const spark = this.querySelector("#loader-inner-spark");
    const shutterTop = this.querySelector('[data-shutter="top"]');
    const shutterBottom = this.querySelector('[data-shutter="bottom"]');
    const statusText = this.querySelector("#loader-status-text");

    if (!overlay) return Promise.resolve();
    overlay.classList.remove("loader-Overlay--hidden");

    return new Promise((resolve) => {
      this.#motionHandle = withMotionContext(
        this,
        ({ isReducedMotion }, gsap) => {
          gsap.set([shutterTop, shutterBottom], { yPercent: 0 });
          gsap.set(overlay, { autoAlpha: 1 });
          gsap.set(core, { scale: 1, autoAlpha: 1 });
          gsap.set(morphPath, { attr: { d: CAPSULE_HEX_PATH } });

          if (isReducedMotion) {
            statusText.textContent = i18n.t("loader.ready");
            gsap.to(overlay, {
              autoAlpha: 0,
              duration: 0.15,
              onComplete: () => {
                overlay.classList.add("loader-Overlay--hidden");
                resolve();
              },
            });
            return;
          }

          const tl = gsap.timeline({
            id: "MoonDexBootLoader",
            onComplete: () => {
              overlay.classList.add("loader-Overlay--hidden");
              resolve();
            },
          });

          const canUseMorphPlugin =
            typeof MorphSVGPlugin !== "undefined" &&
            typeof SVGPathElement !== "undefined";

          tl.fromTo(
            core,
            { scale: 0.78, autoAlpha: 0 },
            {
              scale: 1,
              autoAlpha: 1,
              duration: MOTION_TOKENS.durations.fast,
              ease: MOTION_TOKENS.easings.dexSnap,
            },
          )
            .to(
              morphPath,
              canUseMorphPlugin
                ? {
                    morphSVG: MOONDEX_OPTIC_LENS_PATH,
                    duration: MOTION_TOKENS.durations.base,
                    ease: MOTION_TOKENS.easings.inOutQuint,
                  }
                : {
                    attr: { d: MOONDEX_OPTIC_LENS_PATH },
                    duration: MOTION_TOKENS.durations.base,
                  },
            )
            .to(
              spark,
              {
                scale: 1.65,
                fill: "#22d3ee",
                duration: MOTION_TOKENS.durations.fast,
                ease: MOTION_TOKENS.easings.dexSnap,
                onComplete: () => {
                  if (statusText)
                    statusText.textContent = i18n.t("loader.ready");
                },
              },
              "<",
            )
            .to(core, {
              scale: 1.12,
              autoAlpha: 0,
              duration: MOTION_TOKENS.durations.fast,
              ease: MOTION_TOKENS.easings.outExpo,
            })
            .to(
              shutterTop,
              {
                yPercent: -102,
                duration: MOTION_TOKENS.durations.base,
                ease: MOTION_TOKENS.easings.inOutQuint,
              },
              "-=0.12",
            )
            .to(
              shutterBottom,
              {
                yPercent: 102,
                duration: MOTION_TOKENS.durations.base,
                ease: MOTION_TOKENS.easings.inOutQuint,
              },
              "<",
            );

          if (import.meta.env?.DEV && typeof GSDevTools !== "undefined") {
            try {
              GSDevTools.create({
                animation: tl,
                minimal: true,
                persisted: false,
              });
            } catch {
              // Evita duplicar instancia de GSDevTools al re-ejecutar el loader
            }
          }
        },
      );
    });
  }
}

if (!customElements.get("md-loader")) {
  customElements.define("md-loader", MdLoader);
}
