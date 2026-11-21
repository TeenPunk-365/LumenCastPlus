import { FILTERS, TABS } from "./constants.js";
import { EventBus } from "./event-bus.js";

export class PlayerStore extends EventBus {
  constructor(tracks = []) {
    super();
    this.trackMeta = new Map(tracks.map((track) => [track.id, { duration: track.duration || 0 }]));
    this.state = {
      tab: TABS.HOME,
      filter: FILTERS.ALL,
      searchQuery: "",
      queue: tracks.map((track) => track.id),
      currentIndex: 0,
      playing: false,
      progress: 0,
      liked: new Set(),
      recent: [],
    };
  }

  getState() { return this.state; }
  currentTrackId() { return this.state.queue[this.state.currentIndex] ?? null; }
  isLiked(trackId) { return this.state.liked.has(trackId); }
  setTab(tab) { this.#patchIfChanged("tab", tab); }
  setFilter(filter) { this.#patchIfChanged("filter", filter); }
  setSearchQuery(searchQuery) { if (this.state.searchQuery !== searchQuery) this.#setState({ searchQuery }); }

  setDuration(trackId, duration) {
    if (!trackId || !Number.isFinite(duration) || duration <= 0) return;
    const prev = this.trackMeta.get(trackId)?.duration ?? 0;
    if (prev === duration) return;
    this.trackMeta.set(trackId, { duration });
    if (this.currentTrackId() === trackId) this.emit("change", this.state);
  }

  playTrack(trackId, queue = null) {
    let nextQueue = this.state.queue;
    let nextIndex = this.state.queue.indexOf(trackId);
    if (queue) {
      nextQueue = queue;
      nextIndex = queue.indexOf(trackId);
    } else if (nextIndex < 0) {
      nextQueue = [trackId, ...this.state.queue.filter((id) => id !== trackId)];
      nextIndex = 0;
    }
    this.#setState({ queue: nextQueue, currentIndex: Math.max(0, nextIndex), playing: true, progress: 0 });
  }

  playPlaylist(playlist) {
    if (!playlist?.trackIds?.length) return;
    this.playTrack(playlist.trackIds[0], [...playlist.trackIds]);
    this.#setState({ recent: [playlist.id, ...this.state.recent.filter((id) => id !== playlist.id)].slice(0, 8) });
  }

  togglePlay() { this.#setState({ playing: !this.state.playing }); }
  next() { if (this.state.queue.length) this.#setState({ currentIndex: (this.state.currentIndex + 1) % this.state.queue.length, progress: 0, playing: true }); }
  prev() {
    if (this.state.progress > 3) { this.#setState({ progress: 0 }); return; }
    if (this.state.queue.length) this.#setState({ currentIndex: (this.state.currentIndex - 1 + this.state.queue.length) % this.state.queue.length, progress: 0, playing: true });
  }
  seek(progress) { this.#setState({ progress: Math.max(0, Math.floor(progress)) }); }
  setProgress(progress, emit = true) {
    const next = Math.max(0, Math.floor(progress));
    if (this.state.progress === next) return;
    this.state = { ...this.state, progress: next };
    if (emit) this.emit("change", this.state);
  }
  tick(duration) {
    if (!this.state.playing) return;
    const nextProgress = this.state.progress + 1;
    if (duration > 0 && nextProgress >= duration) { this.next(); return; }
    this.setProgress(nextProgress);
  }
  toggleLike(trackId) {
    const liked = new Set(this.state.liked);
    if (liked.has(trackId)) liked.delete(trackId); else liked.add(trackId);
    this.#setState({ liked });
  }

  #patchIfChanged(key, value) { if (this.state[key] !== value) this.#setState({ [key]: value }); }
  #setState(patch) { this.state = { ...this.state, ...patch }; this.emit("change", this.state); }
}
