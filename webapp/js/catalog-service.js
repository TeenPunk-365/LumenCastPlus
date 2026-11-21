import { FILTERS, ITEM_KINDS } from "./constants.js";

export class CatalogService {
  constructor({ tracks, playlists, artists, categories }) {
    this.tracks = [...tracks];
    this.playlists = [...playlists];
    this.artists = [...artists];
    this.categories = [...categories];
    this.trackById = new Map(this.tracks.map((track) => [track.id, track]));
    this.playlistById = new Map(this.playlists.map((playlist) => [playlist.id, playlist]));
    this.rssPlaylists = [];
  }

  getTrack(id) { return this.trackById.get(id) ?? null; }
  getPlaylist(id) { return this.playlistById.get(id) ?? null; }

  setTrackDuration(id, duration) {
    const track = this.trackById.get(id);
    if (track && Number.isFinite(duration) && duration > 0) track.duration = Math.floor(duration);
  }

  searchTracks(query) {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    return this.tracks.filter((track) =>
      `${track.title} ${track.artist}`.toLowerCase().includes(normalized),
    );
  }

  getRecentItems(ids) {
    return ids
      .map((id) => this.getPlaylist(id) ?? this.getTrack(id))
      .filter(Boolean)
      .map((item) => this.#withKind(item));
  }

  getLibraryItems(filter) {
    const playlists = this.playlists.map((item) => this.#withKind(item, ITEM_KINDS.PLAYLIST));
    const artists = this.artists.map((item) => this.#withKind(item, ITEM_KINDS.ARTIST));
    if (filter === FILTERS.PLAYLIST) return playlists;
    if (filter === FILTERS.ARTIST) return artists;
    return [...playlists, ...artists];
  }

  getHomeSections(recentIds) {
    return {
      quickPlaylists: this.playlists.slice(0, 6),
      madeForYou: this.playlists.slice(0, 4),
      popular: [...this.playlists.slice(2), ...this.playlists.slice(0, 2)].slice(0, 6),
      recent: this.getRecentItems(recentIds),
    };
  }

  addRssFeed(feed) {
    const feedId = `rss-${this.#hash(feed.link || feed.title || feed.author || "feed")}`;
    const existing = this.getPlaylist(feedId);
    const palette = this.#palette(feed.title);

    const episodes = (feed.episodes || []).filter((ep) => ep?.audio_url).map((ep, idx) => {
      const id = ep.id || `${feedId}-ep-${idx}`;
      const track = this.trackById.get(id) || { id };
      Object.assign(track, {
        id,
        title: ep.title || `Эпизод ${idx + 1}`,
        artist: ep.artist || feed.author || feed.title || "Podcast",
        duration: Number(ep.duration) || track.duration || 0,
        color: palette,
        cover: this.#cover(ep.cover),
        audioUrl: ep.audio_url,
        description: ep.description || "",
        kind: ITEM_KINDS.TRACK,
        source: "rss",
      });
      this.trackById.set(id, track);
      if (!this.tracks.some((t) => t.id === id)) this.tracks.push(track);
      return id;
    });

    const playlist = existing || { id: feedId };
    Object.assign(playlist, {
      id: feedId,
      title: feed.title || "RSS Podcast",
      subtitle: feed.author || "RSS Feed",
      color: palette,
      icon: this.#cover(feed.cover),
      trackIds: episodes,
      kind: ITEM_KINDS.PLAYLIST,
      source: "rss",
    });

    if (!existing) {
      this.playlists.unshift(playlist);
      this.playlistById.set(playlist.id, playlist);
      this.rssPlaylists.unshift(playlist);
    }
    return playlist;
  }

  #withKind(item, kind = item.trackIds ? ITEM_KINDS.PLAYLIST : ITEM_KINDS.TRACK) { return { ...item, kind }; }
  #cover(value) { return typeof value === "string" && value.startsWith("http") ? "🎙️" : (value || "🎙️"); }
  #palette(seed) {
    const palettes = [["#6f8fa9", "#cfdbe4"], ["#8f8a82", "#ddd4c6"], ["#7a90a3", "#d8d0c3"], ["#6482a0", "#d3dde5"]];
    let h = 0; const s = String(seed || "rss");
    for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return palettes[h % palettes.length];
  }
  #hash(value) {
    let h = 0; const s = String(value || "");
    for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }
}
