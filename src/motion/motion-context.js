import { initMotionRegistry, gsap } from "./gsap-registry.js";
import { appStore } from "../core/state/signal-store.js";

export function withMotionContext(scopeElement, setupCallback) {
  initMotionRegistry();
  const mm = gsap.matchMedia();

  const ctx = gsap.context(() => {
    mm.add(
      {
        isFullMotion: "(prefers-reduced-motion: no-preference)",
        isReducedMotion: "(prefers-reduced-motion: reduce)",
        isDesktop: "(min-width: 768px)",
        isMobile: "(max-width: 767px)",
      },
      (context) => {
        appStore.setState({
          reducedMotion: Boolean(context.conditions.isReducedMotion),
        });
        return setupCallback(context.conditions, gsap);
      },
    );
  }, scopeElement);

  return {
    revert() {
      mm.revert();
      ctx.revert();
    },
  };
}
