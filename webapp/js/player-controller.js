import { TABS, THEME_KEY } from "./constants.js";
import { greetingByHour } from "./utils.js";

export class PlayerController {
  constructor({ store, catalog, view, telegram, rss, featuredFeeds = [], timer = window, storage = window.localStorage }) {
    this.store = store;
    this.catalog = catalog;
    this.view = view;
    this.telegram = telegram;
    this.rss = rss;
    this.featuredFeeds = featuredFeeds;
    this.timer = timer;
    this.storage = storage;
    this.intervalId = null;
    this.audio = new Audio();
    this.audio.preload = "metadata";
  }

  init() {
    this.#applyInitialTheme();
    this.telegram.init();
    this.telegram.syncTheme(this.#currentTheme());
    this.#renderGreeting();
    this.#bindEvents();
    this.#bindAudio();
    this.store.on("change", () => this.#render());
    this.#bootstrapFeeds();
    this.#render();
    this.#startTicker();
  }

  #bindEvents() {
    this.view.bindTabs((tab) => this.#setTab(tab));
    this.view.bindFilters((filter) => this.#setFilter(filter));
    this.view.bindSearch((query) => this.store.setSearchQuery(query));
    this.view.bindPlayerControls({
      onTogglePlay: () => this.#togglePlay(),
      onNext: () => this.#next(),
      onPrev: () => this.#prev(),
      onToggleLike: () => this.#toggleLike(),
      onSeek: (ratio) => this.#seek(ratio),
    });
    this.view.bindDelegatedClicks({
      onPlaylist: (id) => this.#playPlaylist(id),
      onTrack: (id) => this.#playTrack(id),
      onArtist: () => this.#setTab(TABS.SEARCH),
      onCategory: (name) => this.#selectCategory(name),
      onFeaturedFeed: (url) => this.#openFeaturedFeed(url),
    });
    this.view.bindTopbar({
      onNotify: () => this.#toggleTheme(),
      onHistory: () => this.#setTab(TABS.LIBRARY),
    });
    this.view.bindRssForm((url) => this.#addRssFeed(url, true));
  }

  #bindAudio() {
    this.audio.addEventListener("loadedmetadata", () => {
      const duration = Math.floor(this.audio.duration || 0);
      const id = this.store.currentTrackId();
      if (duration > 0) {
        this.store.setDuration(id, duration);
        this.catalog.setTrackDuration(id, duration);
      }
      this.#render();
    });
    this.audio.addEventListener("timeupdate", () => {
      if (!this.#isAudioTrack()) return;
      this.store.setProgress(Math.floor(this.audio.currentTime || 0));
    });
    this.audio.addEventListener("ended", () => { if (this.#isAudioTrack()) this.store.next(); });
    this.audio.addEventListener("error", () => {
      if (this.#isAudioTrack()) this.view.setRssStatus("Не удалось воспроизвести аудио эпизода.", true);
    });
  }

  async #bootstrapFeeds() {
    this.view.setRssStatus("Загружаю подборку подкастов...");
    const saved = this.rss?.getSavedFeeds?.() ?? [];
    const urls = [...new Set([...this.featuredFeeds.map((f) => f.url), ...saved])];
    let loaded = 0;
    for (const url of urls) {
      const ok = await this.#loadFeed(url, false);
      if (ok) loaded += 1;
    }
    this.view.setRssStatus(loaded ? `Доступно RSS-лент: ${loaded}. Можно добавить свою.` : "Не удалось загрузить RSS. Добавьте свою ссылку.", !loaded);
    this.#render();
  }

  async #loadFeed(url, persist) {
    try {
      const feed = await this.rss.fetchFeed(url);
      this.catalog.addRssFeed(feed, this.featuredFeeds.find((f) => f.url === url));
      if (persist) this.rss.saveFeed(url);
      return true;
    } catch (_) {
      return false;
    }
  }

  async #openFeaturedFeed(url) {
    const meta = this.featuredFeeds.find((f) => f.url === url);
    const existing = this.catalog.playlists.find((p) => p.feedUrl === url);
    if (existing?.trackIds?.length) {
      this.store.playPlaylist(existing);
      this.view.setRssStatus(`?????? ???????: ${existing.title}`);
      this.telegram.haptic("light");
      return;
    }
    await this.#addRssFeed(url, true, meta);
  }

  async #addRssFeed(url, persist, meta = null) {
    if (!url) { this.view.setRssStatus("??????? URL RSS-?????.", true); return; }
    const resolvedMeta = meta || this.featuredFeeds.find((f) => f.url === url);
    this.view.setRssStatus(`???????? RSS: ${resolvedMeta?.title || url}...`);
    try {
      const feed = await this.rss.fetchFeed(url);
      const playlist = this.catalog.addRssFeed(feed, resolvedMeta);
      if (persist) this.rss.saveFeed(url);
      if (!playlist.trackIds.length) {
        this.view.setRssStatus(`RSS ????????, ?? ???????????? ?? ???????: ${playlist.title}`, true);
        this.#render();
        return;
      }
      this.view.setRssStatus(`?????????: ${feed.title}. ????????: ${feed.episodes?.length ?? 0}`);
      this.store.playPlaylist(playlist);
      this.telegram.haptic("light");
    } catch (error) {
      console.error("RSS load failed", url, error);
      const msg = String(error?.message || "");
      const hint = msg.includes("http_404")
        ? "API /api/rss ??????????. ????????? backend: python main.py ? ???????? /webapp/ ? ???? ?? ?????."
        : (msg || "?? ??????? ?????????");
      this.view.setRssStatus(`?????? RSS (${resolvedMeta?.title || "?????"}): ${hint}`, true);
    }
  }

  #renderGreeting() {
    const user = this.telegram.getUser();
    const name = user?.first_name || user?.username || "?";
    this.view.setGreeting(greetingByHour(), name.charAt(0).toUpperCase());
  }

  #render() {
    const state = this.store.getState();
    const currentTrack = this.catalog.getTrack(this.store.currentTrackId());
    const home = this.catalog.getHomeSections(state.recent);
    this.#syncAudio(currentTrack, state.playing);

    this.view.renderShell({ tab: state.tab, filter: state.filter, featuredFeeds: this.featuredFeeds });
    this.view.renderHome({ ...home, currentTrackId: currentTrack?.id ?? null, playing: state.playing });
    this.view.renderSearch({ query: state.searchQuery, results: this.catalog.searchTracks(state.searchQuery), currentTrackId: currentTrack?.id ?? null });
    this.view.renderLibrary(this.catalog.getLibraryItems(state.filter));
    this.view.renderPlayer({ track: currentTrack, playing: state.playing, progress: state.progress, liked: currentTrack ? this.store.isLiked(currentTrack.id) : false });
  }

  #syncAudio(track, playing) {
    if (!track?.audioUrl) {
      if (!this.audio.paused) this.audio.pause();
      if (this.audio.src) { this.audio.removeAttribute("src"); this.audio.load(); }
      return;
    }
    if (this.audio.src !== track.audioUrl) {
      this.audio.src = track.audioUrl;
      this.audio.currentTime = this.store.getState().progress || 0;
    }
    if (playing && this.audio.paused) this.audio.play().catch(() => {});
    else if (!playing && !this.audio.paused) this.audio.pause();
  }

  #isAudioTrack() { return Boolean(this.catalog.getTrack(this.store.currentTrackId())?.audioUrl); }

  #applyInitialTheme() {
    const saved = this.#readTheme();
    const preferred = this.telegram.getColorScheme();
    this.#setTheme(saved || preferred || "light", false);
  }
  #toggleTheme() { this.#setTheme(this.#currentTheme() === "dark" ? "light" : "dark", true); this.telegram.haptic("light"); }
  #setTheme(theme, persist) { document.documentElement.dataset.theme = theme; this.view.setTheme(theme); this.telegram.syncTheme(theme); if (persist) this.#writeTheme(theme); }
  #currentTheme() { return document.documentElement.dataset.theme === "dark" ? "dark" : "light"; }
  #readTheme() { try { return this.storage.getItem(THEME_KEY); } catch (_) { return null; } }
  #writeTheme(theme) { try { this.storage.setItem(THEME_KEY, theme); } catch (_) {} }

  #setTab(tab) { this.store.setTab(tab); this.telegram.haptic("light"); }
  #setFilter(filter) { this.store.setFilter(filter); this.telegram.haptic("light"); }
  #playTrack(trackId) { this.store.playTrack(trackId); this.telegram.haptic("light"); }
  #playPlaylist(playlistId) { this.store.playPlaylist(this.catalog.getPlaylist(playlistId)); this.telegram.haptic("light"); }
  #selectCategory(name) { this.view.setSearchValue(name); this.store.setSearchQuery(name); this.telegram.haptic("light"); }
  #togglePlay() { this.store.togglePlay(); this.telegram.haptic("light"); }
  #next() { this.store.next(); this.telegram.haptic("light"); }
  #prev() { this.store.prev(); this.telegram.haptic("light"); }
  #toggleLike() { const id = this.store.currentTrackId(); if (id) { this.store.toggleLike(id); this.telegram.haptic("light"); } }

  #seek(ratio) {
    const track = this.catalog.getTrack(this.store.currentTrackId());
    if (!track) return;
    const next = Math.floor(ratio * (track.duration || 0));
    if (track.audioUrl) this.audio.currentTime = next;
    this.store.seek(next);
  }

  #startTicker() {
    this.#stopTicker();
    this.intervalId = this.timer.setInterval(() => {
      const track = this.catalog.getTrack(this.store.currentTrackId());
      if (track && !track.audioUrl) this.store.tick(track.duration);
    }, 1000);
  }
  #stopTicker() { if (this.intervalId) { this.timer.clearInterval(this.intervalId); this.intervalId = null; } }
}
