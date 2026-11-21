import { artStyle, escapeHtml, formatTime } from "./utils.js";

const LANG_LABELS = { ru: "Русский", en: "English" };

export class PlayerView {
  constructor(root = document) {
    this.root = root;
    this.refs = {
      main: root.getElementById("main"),
      greeting: root.getElementById("greeting"),
      avatar: root.getElementById("avatar"),
      quickGrid: root.getElementById("quick-grid"),
      madeForYou: root.getElementById("made-for-you"),
      popularPlaylists: root.getElementById("popular-playlists"),
      recentlyPlayed: root.getElementById("recently-played"),
      featuredFeeds: root.getElementById("featured-feeds"),
      searchInput: root.getElementById("search-input"),
      searchDefault: root.getElementById("search-default"),
      searchResultsWrap: root.getElementById("search-results-wrap"),
      searchResults: root.getElementById("search-results"),
      libList: root.getElementById("lib-list"),
      playerArt: root.getElementById("player-art"),
      playerTitle: root.getElementById("player-title"),
      playerSub: root.getElementById("player-sub"),
      playBtn: root.getElementById("play-btn"),
      likeBtn: root.getElementById("like-btn"),
      timeCur: root.getElementById("time-cur"),
      timeDur: root.getElementById("time-dur"),
      progressFill: root.getElementById("progress-fill"),
    };
  }

  bindTabs(onTabChange) {
    this.root.querySelectorAll(".nav-item").forEach((button) => button.addEventListener("click", () => onTabChange(button.dataset.tab)));
    this.root.querySelectorAll("[data-goto]").forEach((link) => link.addEventListener("click", (event) => { event.preventDefault(); onTabChange(link.dataset.goto); }));
  }

  bindFilters(onFilterChange) {
    this.root.querySelectorAll(".filter-chip").forEach((chip) => chip.addEventListener("click", () => onFilterChange(chip.dataset.filter)));
  }

  bindPlayerControls(handlers) {
    this.root.getElementById("play-btn").addEventListener("click", handlers.onTogglePlay);
    this.root.getElementById("next-btn").addEventListener("click", handlers.onNext);
    this.root.getElementById("prev-btn").addEventListener("click", handlers.onPrev);
    this.root.getElementById("like-btn").addEventListener("click", handlers.onToggleLike);
    this.root.getElementById("progress-bar").addEventListener("click", (event) => {
      const rect = event.currentTarget.getBoundingClientRect();
      handlers.onSeek(Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)));
    });
  }

  bindSearch(onSearch) { this.refs.searchInput.addEventListener("input", (event) => onSearch(event.target.value)); }

  bindTopbar(handlers) {
    this.refs.themeBtn = this.root.getElementById("notify-btn");
    this.refs.themeBtn.addEventListener("click", handlers.onNotify);
    this.root.getElementById("history-btn").addEventListener("click", handlers.onHistory);
  }

  setTheme(theme) {
    const dark = theme === "dark";
    if (this.refs.themeBtn) {
      this.refs.themeBtn.textContent = dark ? "☀" : "🌙";
      this.refs.themeBtn.title = dark ? "Светлая тема" : "Тёмная тема";
      this.refs.themeBtn.setAttribute("aria-label", this.refs.themeBtn.title);
    }
  }

  bindRssForm(handler) {
    const form = this.root.getElementById("rss-form");
    const input = this.root.getElementById("rss-input");
    if (!form || !input) return;
    form.addEventListener("submit", (event) => { event.preventDefault(); handler(input.value.trim()); });
  }

  setRssStatus(message, isError = false) {
    const el = this.root.getElementById("rss-status");
    if (!el) return;
    el.textContent = message;
    el.classList.toggle("is-error", isError);
  }

  bindDelegatedClicks(handlers) {
    this.root.body.addEventListener("click", (event) => {
      const quick = event.target.closest("[data-playlist]");
      if (quick) return handlers.onPlaylist(quick.dataset.playlist);
      const featured = event.target.closest("[data-feed-url]");
      if (featured) return handlers.onFeaturedFeed(featured.dataset.feedUrl);
      const card = event.target.closest(".media-card");
      if (card) return card.dataset.type === "playlist" ? handlers.onPlaylist(card.dataset.id) : handlers.onTrack(card.dataset.id);
      const row = event.target.closest(".track-row");
      if (row) return handlers.onTrack(row.dataset.track);
      const lib = event.target.closest(".lib-item");
      if (lib) return lib.dataset.type === "playlist" ? handlers.onPlaylist(lib.dataset.id) : handlers.onArtist(lib.dataset.id);
      const category = event.target.closest(".cat-card");
      if (category) return handlers.onCategory(category.dataset.cat);
    });
  }

  setGreeting(text, avatarLetter) { this.refs.greeting.textContent = text; this.refs.avatar.textContent = avatarLetter; }

  renderShell({ tab, filter, featuredFeeds }) {
    this.refs.main.dataset.tab = tab;
    this.root.querySelectorAll(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
    this.root.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view.id === `view-${tab}`));
    this.root.querySelectorAll(".filter-chip").forEach((chip) => chip.classList.toggle("active", chip.dataset.filter === filter));
    this.refs.featuredFeeds.innerHTML = (featuredFeeds || []).map((feed) => this.featuredFeedCard(feed)).join("");
  }

  renderHome({ quickPlaylists, madeForYou, popular, recent, currentTrackId, playing }) {
    this.refs.quickGrid.innerHTML = quickPlaylists.map((item) => this.quickCard(item)).join("");
    this.refs.madeForYou.innerHTML = madeForYou.map((item) => this.mediaCard(item, "playlist", currentTrackId, playing)).join("");
    this.refs.popularPlaylists.innerHTML = popular.map((item) => this.mediaCard(item, "playlist", currentTrackId, playing)).join("");
    this.refs.recentlyPlayed.innerHTML = recent.map((item) => this.mediaCard(item, item.kind, currentTrackId, playing)).join("");
  }

  renderSearch({ query, results, currentTrackId }) {
    const normalized = query.trim();
    const showResults = normalized.length > 0;
    this.refs.searchDefault.style.display = showResults ? "none" : "";
    this.refs.searchResultsWrap.style.display = showResults ? "" : "none";
    if (!showResults) return;
    this.refs.searchResults.innerHTML = results.length
      ? results.map((track) => this.trackRow(track, currentTrackId)).join("")
      : `<div class="empty-state">Ничего не найдено по запросу "${escapeHtml(query)}"</div>`;
  }

  renderLibrary(items) { this.refs.libList.innerHTML = items.map((item) => this.libraryItem(item)).join(""); }

  renderPlayer({ track, playing, progress, liked }) {
    if (!track) return;
    this.refs.playerArt.style.cssText = artStyle(track.color);
    this.refs.playerArt.innerHTML = `<span>${track.cover || "🎙️"}</span>`;
    this.#setMarquee(this.refs.playerTitle, track.title);
    this.refs.playerSub.textContent = track.artist;
    this.refs.playBtn.textContent = playing ? "❚❚" : "▶";
    this.refs.timeCur.textContent = formatTime(progress);
    this.refs.timeDur.textContent = formatTime(track.duration);
    this.refs.progressFill.style.width = `${track.duration ? (progress / track.duration) * 100 : 0}%`;
    this.refs.likeBtn.textContent = liked ? "♥" : "♡";
    this.refs.likeBtn.classList.toggle("liked", liked);
  }

  #setMarquee(container, text) {
    const safe = escapeHtml(text);
    container.innerHTML = `<span class="marquee__track"><span class="marquee__text">${safe}</span><span class="marquee__copy" aria-hidden="true">${safe}</span></span>`;
    container.classList.add("marquee");
    const apply = () => {
      const first = container.querySelector(".marquee__text");
      if (!first) return;
      const overflow = first.scrollWidth > container.clientWidth + 2;
      container.classList.toggle("is-overflowing", overflow);
      if (overflow) container.style.setProperty("--marquee-duration", `${Math.max(8, Math.min(18, text.length * 0.25))}s`);
      else container.style.removeProperty("--marquee-duration");
    };
    requestAnimationFrame(() => { apply(); setTimeout(apply, 60); setTimeout(apply, 250); });
  }

  setSearchValue(value) { this.refs.searchInput.value = value; }

  quickCard(item) {
    return `<button class="quick-card" data-playlist="${item.id}"><div class="quick-art" style="${artStyle(item.color)}">${item.icon}</div><span>${escapeHtml(item.title)}</span></button>`;
  }

  featuredFeedCard(feed) {
    const lang = LANG_LABELS[feed.language] || feed.language || "RSS";
    return `
      <button class="feed-card" data-feed-url="${escapeHtml(feed.url)}">
        <div class="feed-art" style="${artStyle(feed.color)}">${feed.icon || "🎙️"}</div>
        <div class="feed-meta">
          <div class="title">${escapeHtml(feed.title)}</div>
          <div class="sub">${escapeHtml(feed.author || "RSS")} • ${escapeHtml(lang)}</div>
          <div class="desc">${escapeHtml(feed.description || "")}</div>
        </div>
      </button>`;
  }

  mediaCard(item, type, currentTrackId, playing) {
    const isPlaying = type === "track" && currentTrackId === item.id && playing;
    const round = item.round ? "round" : "";
    const lang = item.language ? ` ? ${LANG_LABELS[item.language] || item.language}` : "";
    const sub = escapeHtml((item.subtitle || item.artist || "") + lang);
    return `
      <div class="media-card ${isPlaying ? "playing" : ""}" data-type="${type}" data-id="${item.id}">
        <div class="media-art ${round}" style="${artStyle(item.color)}"><div class="art-inner">${item.icon || item.cover || "???"}</div><div class="play-fab">${isPlaying ? "??" : "?"}</div></div>
        <div class="title">${escapeHtml(item.title)}</div>
        <div class="sub">${sub}</div>
      </div>`;
  }

  trackRow(track, currentTrackId) {
    const active = currentTrackId === track.id;
    return `
      <div class="track-row ${active ? "active" : ""}" data-track="${track.id}">
        <div class="track-art" style="${artStyle(track.color)}">${track.cover || "🎙️"}</div>
        <div class="track-meta"><div class="title">${escapeHtml(track.title)}</div><div class="sub">${escapeHtml(track.artist)}</div></div>
        <div class="dur">${formatTime(track.duration)}</div>
      </div>`;
  }

  categoryCard(category) {
    return `<div class="cat-card" style="background:${category.color}" data-cat="${escapeHtml(category.name)}"><span>${escapeHtml(category.name)}</span><div class="cat-art">${category.icon}</div></div>`;
  }

  libraryItem(item) {
    const lang = item.language ? ` • ${LANG_LABELS[item.language] || item.language}` : "";
    const kindLabel = item.kind === "artist" ? "Автор" : "Подкаст";
    const sub = item.kind === "artist" ? kindLabel : `${kindLabel} • ${item.subtitle}${lang}`;
    return `
      <div class="lib-item" data-type="${item.kind}" data-id="${item.id}">
        <div class="lib-art ${item.round ? "round" : ""}" style="${artStyle(item.color)}">${item.icon || "🎙️"}</div>
        <div class="lib-meta"><div class="title">${escapeHtml(item.title)}</div><div class="sub">${escapeHtml(sub)}</div></div>
      </div>`;
  }
}
