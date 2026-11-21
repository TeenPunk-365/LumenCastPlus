import { ARTISTS, CATEGORIES, PLAYLISTS, TRACKS } from "./data.js";
import { CatalogService } from "./catalog-service.js";
import { PlayerController } from "./player-controller.js";
import { PlayerStore } from "./player-store.js";
import { PlayerView } from "./player-view.js";
import { TelegramService } from "./telegram-service.js";

function bootstrap() {
  const catalog = new CatalogService({ tracks: TRACKS, playlists: PLAYLISTS, artists: ARTISTS, categories: CATEGORIES });
  const store = new PlayerStore(TRACKS);
  const view = new PlayerView(document);
  const telegram = new TelegramService(window.Telegram?.WebApp ?? null);
  const controller = new PlayerController({ store, catalog, view, telegram });
  controller.init();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}
