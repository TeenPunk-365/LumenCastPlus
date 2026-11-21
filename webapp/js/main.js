import { CatalogService } from "./catalog-service.js";
import { PlayerController } from "./player-controller.js";
import { PlayerStore } from "./player-store.js";
import { PlayerView } from "./player-view.js";
import { RssService } from "./rss-service.js";
import { TelegramService } from "./telegram-service.js";
import { PODCAST_FEEDS } from "./podcast-feeds.js";

document.addEventListener("DOMContentLoaded", () => {
  const catalog = new CatalogService({
    tracks: [],
    playlists: [],
    artists: [],
    categories: [],
  });
  const rss = new RssService({ baseUrl: window.location.origin });
  const controller = new PlayerController({
    store: new PlayerStore([]),
    catalog,
    view: new PlayerView(document),
    telegram: new TelegramService(window.Telegram),
    rss,
    featuredFeeds: PODCAST_FEEDS,
  });
  controller.init();
});
