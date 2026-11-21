import { CatalogService } from "./catalog-service.js";
import { PlayerController } from "./player-controller.js";
import { PlayerStore } from "./player-store.js";
import { PlayerView } from "./player-view.js";
import { RssService } from "./rss-service.js";
import { TelegramService } from "./telegram-service.js";
import { ARTISTS, CATEGORIES, PLAYLISTS, TRACKS } from "./data.js";

document.addEventListener("DOMContentLoaded", () => {
  const catalog = new CatalogService({
    tracks: TRACKS,
    playlists: PLAYLISTS,
    artists: ARTISTS,
    categories: CATEGORIES,
  });
  const rss = new RssService({ baseUrl: window.location.origin });
  const controller = new PlayerController({
    store: new PlayerStore(TRACKS),
    catalog,
    view: new PlayerView(document),
    telegram: new TelegramService(window.Telegram),
    rss,
  });
  controller.init();
});
