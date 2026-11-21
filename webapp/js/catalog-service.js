import { FILTERS, ITEM_KINDS } from "./constants.js";

export class CatalogService {
  constructor({ tracks, playlists, artists, categories }) {
    this.tracks = tracks;
    this.playlists = playlists;
    this.artists = artists;
    this.categories = categories;
    this.trackById = new Map(tracks.map((track) => [track.id, track]));
    this.playlistById = new Map(playlists.map((playlist) => [playlist.id, playlist]));
  }

  getTrack(id) {
    return this.trackById.get(id) ?? null;
  }

  getPlaylist(id) {
    return this.playlistById.get(id) ?? null;
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
      popular: [...this.playlists.slice(2), ...this.playlists.slice(0, 2)],
      recent: this.getRecentItems(recentIds),
    };
  }

  #withKind(item, kind = item.trackIds ? ITEM_KINDS.PLAYLIST : ITEM_KINDS.TRACK) {
    return { ...item, kind };
  }
}
