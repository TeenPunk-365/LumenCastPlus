export class RssService {
  constructor({ baseUrl = "", storage = window.localStorage, key = "lumencast-rss-feeds" } = {}) {
    this.baseUrl = baseUrl;
    this.storage = storage;
    this.key = key;
  }

  getSavedFeeds() {
    try {
      const raw = this.storage.getItem(this.key);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
    } catch (_) {
      return [];
    }
  }

  saveFeed(url) {
    const feeds = this.getSavedFeeds();
    if (!feeds.includes(url)) feeds.unshift(url);
    try { this.storage.setItem(this.key, JSON.stringify(feeds.slice(0, 20))); } catch (_) {}
  }

  async fetchFeed(url) {
    const endpoint = `${this.baseUrl}/api/rss?url=${encodeURIComponent(url)}`;
    const response = await fetch(endpoint, { headers: { Accept: "application/json" } });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.error || "feed_fetch_failed");
    }
    return data.feed;
  }
}
