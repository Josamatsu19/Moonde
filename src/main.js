import "./ui/primitives/md-loader.js";
import { initMotionRegistry } from "./motion/gsap-registry.js";
import { dbManager, STORES } from "./core/storage/indexeddb-manager.js";
import { i18n } from "./core/i18n/i18n-service.js";
import { appStore } from "./core/state/signal-store.js";
import { Router } from "./app/router.js";
import { AppShell } from "./app/app-shell.js";

async function bootstrap() {
  initMotionRegistry();

  await i18n.init();
  const seededCount = await dbManager.hydrateSeedIfNeeded();
  const cacheCount = await dbManager.count(STORES.API_CACHE);
  appStore.setState({
    seededSpeciesCount: seededCount,
    cacheEntriesCount: cacheCount,
  });

  const root = document.querySelector("#app-root");
  let shell;

  const renderRoute = (outlet, pathname) =>
    shell.renderDiagnosticsView(outlet, pathname);
  const router = new Router({
    "/": renderRoute,
    "/catalog": renderRoute,
    "/evolutions": renderRoute,
    "/battle-lab": renderRoute,
    "/inventory": renderRoute,
    "/atlas": renderRoute,
    "/history": renderRoute,
  });

  shell = new AppShell(root, router);
  await shell.init();

  const bootLoader = document.querySelector("#boot-loader");
  if (bootLoader) {
    await bootLoader.playBootSequence();
  }
}

bootstrap();
