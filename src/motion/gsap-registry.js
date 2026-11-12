import { gsap } from "gsap";
import { CustomEase } from "gsap/CustomEase";
import { MorphSVGPlugin } from "gsap/MorphSVGPlugin";
import { GSDevTools } from "gsap/GSDevTools";

let isInitialized = false;

export function initMotionRegistry() {
  if (isInitialized) return gsap;

  gsap.registerPlugin(CustomEase, MorphSVGPlugin, GSDevTools);
  gsap.config({ nullTargetWarn: false });
  gsap.ticker.lagSmoothing(500, 33);

  CustomEase.create("easeOutExpo", "M0,0 C0.16,1 0.3,1 1,1");
  CustomEase.create("easeInOutQuint", "M0,0 C0.83,0 0.17,1 1,1");
  CustomEase.create("dexSnap", "M0,0 C0.22,1.25 0.36,1 1,1");

  isInitialized = true;
  return gsap;
}

export { gsap, CustomEase, MorphSVGPlugin, GSDevTools };
