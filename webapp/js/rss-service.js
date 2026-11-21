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
    const backendError = await this.#tryBackend(url);
    if (backendError?.feed) return backendError.feed;
    const xml = await this.#fetchXml(url);
    return this.#parseFeed(xml, url);
  }

  async #tryBackend(url) {
    if (!this.baseUrl || this.baseUrl === "null") return null;
    try {
      const endpoint = `${this.baseUrl}/api/rss?url=${encodeURIComponent(url)}`;
      const response = await fetch(endpoint, { headers: { Accept: "application/json" } });
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        if (response.status === 404) return null;
        return null;
      }
      const data = await response.json();
      if (response.ok && data.ok) return { feed: data.feed };
      if (response.status === 404) return null;
      throw new Error(data.error || "feed_fetch_failed");
    } catch (error) {
      if (String(error?.message || "").startsWith("http_")) throw error;
      return null;
    }
  }

  async #fetchXml(url) {
    const attempts = [
      () => this.#fetchXmlDirect(url),
      () => this.#fetchXmlDirect(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`),
      () => this.#fetchAllOriginsGet(url),
      () => this.#fetchXmlDirect(`https://corsproxy.io/?url=${encodeURIComponent(url)}`),
      () => this.#fetchXmlDirect(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`),
    ];
    let lastError = null;
    for (const attempt of attempts) {
      try {
        const xml = await attempt();
        if (xml) return xml;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error("feed_fetch_failed");
  }

  async #fetchXmlDirect(endpoint) {
    const response = await fetch(endpoint, { headers: { Accept: "application/rss+xml, application/xml, text/xml, application/json, */*" } });
    if (!response.ok) throw new Error(`http_${response.status}`);
    const text = await response.text();
    if (text && /<(rss|feed|rdf:RDF)\b/i.test(text)) return text;
    throw new Error("invalid_rss_response");
  }

  async #fetchAllOriginsGet(url) {
    const endpoint = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const response = await fetch(endpoint, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`http_${response.status}`);
    const data = await response.json();
    const contents = typeof data?.contents === "string" ? data.contents : "";
    if (contents && /<(rss|feed|rdf:RDF)\b/i.test(contents)) return contents;
    throw new Error("invalid_rss_response");
  }

  #parseFeed(xml, sourceUrl) {
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    if (doc.querySelector("parsererror")) throw new Error("invalid_rss_feed");
    const atomFeed = doc.querySelector("feed");
    if (atomFeed) return this.#parseAtom(atomFeed, sourceUrl);
    const channel = doc.querySelector("channel");
    if (!channel) throw new Error("invalid_rss_feed");
    return this.#parseRss(channel, sourceUrl);
  }

  #parseRss(channel, sourceUrl) {
    const title = this.#text(channel, "title") || "Podcast";
    const author = this.#text(channel, "itunes\\:author, author") || title;
    const description = this.#text(channel, "description, itunes\\:summary") || "";
    const cover = this.#rssImage(channel);
    const link = this.#text(channel, "link") || sourceUrl || null;
    const language = this.#normalizeLang(this.#text(channel, "language"));
    const items = [...channel.querySelectorAll("item")];
    const episodes = items.map((item, index) => {
      const audioUrl = this.#rssAudioUrl(item);
      if (!audioUrl) return null;
      return {
        id: this.#episodeId(sourceUrl, audioUrl, index),
        title: this.#text(item, "title") || `Эпизод ${index + 1}`,
        artist: this.#text(item, "itunes\\:author") || author,
        duration: this.#parseDuration(this.#text(item, "itunes\\:duration")),
        audio_url: audioUrl,
        published_at: this.#normalizeDate(this.#text(item, "pubDate")),
        description: this.#text(item, "description, itunes\\:summary") || "",
        cover: this.#rssItemImage(item) || cover,
        link: this.#text(item, "link") || null,
      };
    }).filter(Boolean);
    return { title, author, description, cover, link, language, episodes };
  }

  #parseAtom(feed, sourceUrl) {
    const title = this.#text(feed, "title") || "Podcast";
    const author = this.#text(feed, "author > name") || title;
    const description = this.#text(feed, "subtitle, summary") || "";
    const cover = this.#attr(feed, "logo", ["href", "uri"]) || this.#attr(feed, "icon", ["href", "uri"]) || "🎙️";
    const link = this.#atomLink(feed, "alternate") || sourceUrl || null;
    const language = this.#normalizeLang(feed.getAttribute("xml:lang") || feed.getAttribute("lang"));
    const entries = [...feed.querySelectorAll("entry")];
    const episodes = entries.map((entry, index) => {
      const audioUrl = this.#atomAudioUrl(entry);
      if (!audioUrl) return null;
      return {
        id: this.#episodeId(sourceUrl, audioUrl, index),
        title: this.#text(entry, "title") || `Эпизод ${index + 1}`,
        artist: author,
        duration: 0,
        audio_url: audioUrl,
        published_at: this.#normalizeDate(this.#text(entry, "updated, published")),
        description: this.#text(entry, "summary, content") || "",
        cover,
        link: this.#atomLink(entry, "alternate"),
      };
    }).filter(Boolean);
    return { title, author, description, cover, link, language, episodes };
  }

  #text(root, selector) {
    const node = root.querySelector(selector);
    const text = node?.textContent?.trim();
    return text || null;
  }

  #attr(root, selector, attrs = ["href", "url", "src"]) {
    const node = root.querySelector(selector);
    if (!node) return null;
    for (const attr of attrs) {
      const value = node.getAttribute(attr)?.trim();
      if (value) return value;
    }
    const text = node.textContent?.trim();
    return text || null;
  }

  #rssImage(channel) {
    const itunes = channel.querySelector("itunes\\:image");
    const href = itunes?.getAttribute("href")?.trim();
    if (href) return href;
    return this.#text(channel, "image > url") || "🎙️";
  }

  #rssItemImage(item) {
    const itunes = item.querySelector("itunes\\:image");
    const href = itunes?.getAttribute("href")?.trim();
    return href || null;
  }

  #rssAudioUrl(item) {
    const enclosure = item.querySelector("enclosure");
    const encUrl = enclosure?.getAttribute("url")?.trim();
    const encType = enclosure?.getAttribute("type") || "";
    if (encUrl && (encType.startsWith("audio") || !encType)) return encUrl;
    const media = item.querySelector("media\\:content");
    const mediaUrl = media?.getAttribute("url")?.trim();
    return mediaUrl || null;
  }

  #atomAudioUrl(entry) {
    const links = [...entry.querySelectorAll("link")];
    for (const link of links) {
      const href = link.getAttribute("href")?.trim();
      const rel = link.getAttribute("rel") || "";
      const type = link.getAttribute("type") || "";
      if (href && (rel === "enclosure" || type.startsWith("audio"))) return href;
    }
    return null;
  }

  #atomLink(element, rel) {
    const links = [...element.querySelectorAll("link")];
    const match = links.find((l) => (l.getAttribute("rel") || "alternate") === rel);
    const href = (match || links[0])?.getAttribute("href")?.trim();
    return href || null;
  }

  #episodeId(sourceUrl, audioUrl, index) {
    const base = `${sourceUrl}|${audioUrl}|${index}`;
    let h = 0;
    for (let i = 0; i < base.length; i += 1) h = (h * 31 + base.charCodeAt(i)) >>> 0;
    return `rss-${h.toString(36)}`;
  }

  #parseDuration(value) {
    if (!value) return 0;
    const raw = String(value).trim();
    if (/^\d+$/.test(raw)) return Number(raw);
    const parts = raw.split(":").map((p) => Number(p));
    if (parts.some((n) => !Number.isFinite(n))) return 0;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
  }

  #normalizeDate(value) {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toISOString();
  }

  #normalizeLang(value) {
    if (!value) return null;
    const lang = String(value).trim().toLowerCase().replace("_", "-");
    return lang || null;
  }
}
