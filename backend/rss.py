from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime
from email.utils import parsedate_to_datetime
from typing import Any
from urllib.parse import urlparse
import xml.etree.ElementTree as ET

import aiohttp


@dataclass(frozen=True, slots=True)
class PodcastEpisode:
    id: str
    title: str
    artist: str
    duration: int
    audio_url: str
    published_at: str | None
    description: str
    cover: str
    link: str | None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True, slots=True)
class PodcastFeed:
    title: str
    author: str
    description: str
    cover: str
    link: str | None
    language: str | None
    episodes: list[PodcastEpisode]

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        data["episodes"] = [episode.to_dict() for episode in self.episodes]
        return data


class RssPodcastService:
    _NS = {
        "itunes": "http://www.itunes.com/dtds/podcast-1.0.dtd",
        "atom": "http://www.w3.org/2005/Atom",
        "media": "http://search.yahoo.com/mrss/",
        "content": "http://purl.org/rss/1.0/modules/content/",
    }

    def __init__(self, session: aiohttp.ClientSession, timeout_seconds: int = 15) -> None:
        self._session = session
        self._timeout = aiohttp.ClientTimeout(total=timeout_seconds)

    async def fetch_feed(self, url: str) -> PodcastFeed:
        self._validate_url(url)
        async with self._session.get(url, timeout=self._timeout, headers={"User-Agent": "LumenCastPlus/1.0"}) as response:
            response.raise_for_status()
            payload = await response.text()
        return self.parse_feed(payload, source_url=url)

    def parse_feed(self, payload: str, source_url: str = "") -> PodcastFeed:
        root = ET.fromstring(payload)
        channel = root.find("channel")
        if channel is None:
            channel = root.find("./atom:feed", self._NS)
        if channel is None:
            raise ValueError("invalid_rss_feed")

        is_atom = channel.tag.endswith("feed")
        if is_atom:
            return self._parse_atom(channel, source_url)
        return self._parse_rss(channel, source_url)

    def _parse_rss(self, channel: ET.Element, source_url: str) -> PodcastFeed:
        feed_title = self._text(channel, "title") or "Podcast"
        feed_author = self._text(channel, "itunes:author") or self._text(channel, "author") or feed_title
        feed_description = self._text(channel, "description") or self._text(channel, "itunes:summary") or ""
        feed_cover = self._rss_image(channel)
        feed_link = self._text(channel, "link") or source_url or None
        language = self._normalize_lang(self._text(channel, "language"))

        episodes: list[PodcastEpisode] = []
        for index, item in enumerate(channel.findall("item")):
            audio_url = self._rss_audio_url(item)
            if not audio_url:
                continue
            title = self._text(item, "title") or f"Episode {index + 1}"
            episodes.append(
                PodcastEpisode(
                    id=self._episode_id(source_url, audio_url, index),
                    title=title,
                    artist=self._text(item, "itunes:author") or feed_author,
                    duration=self._parse_duration(self._text(item, "itunes:duration")),
                    audio_url=audio_url,
                    published_at=self._normalize_date(self._text(item, "pubDate")),
                    description=self._text(item, "description") or self._text(item, "itunes:summary") or "",
                    cover=self._rss_item_image(item) or feed_cover,
                    link=self._text(item, "link") or None,
                )
            )

        return PodcastFeed(
            title=feed_title,
            author=feed_author,
            description=feed_description,
            cover=feed_cover,
            link=feed_link,
            language=language,
            episodes=episodes,
        )

    def _parse_atom(self, feed: ET.Element, source_url: str) -> PodcastFeed:
        title = self._text(feed, "atom:title") or "Podcast"
        author = self._text(feed, "atom:author/atom:name") or title
        subtitle = self._text(feed, "atom:subtitle") or ""
        cover = self._attr(feed, "atom:logo") or self._attr(feed, "atom:icon") or "🎙️"
        link = self._atom_link(feed, "alternate") or source_url or None
        language = self._normalize_lang(feed.attrib.get("{http://www.w3.org/XML/1998/namespace}lang"))

        episodes: list[PodcastEpisode] = []
        for index, entry in enumerate(feed.findall("atom:entry", self._NS)):
            audio_url = self._atom_audio_url(entry)
            if not audio_url:
                continue
            episodes.append(
                PodcastEpisode(
                    id=self._episode_id(source_url, audio_url, index),
                    title=self._text(entry, "atom:title") or f"Episode {index + 1}",
                    artist=author,
                    duration=0,
                    audio_url=audio_url,
                    published_at=self._normalize_date(self._text(entry, "atom:updated") or self._text(entry, "atom:published")),
                    description=self._text(entry, "atom:summary") or "",
                    cover=cover,
                    link=self._atom_link(entry, "alternate"),
                )
            )

        return PodcastFeed(title=title, author=author, description=subtitle, cover=cover, link=link, language=language, episodes=episodes)

    @staticmethod
    def _validate_url(url: str) -> None:
        parsed = urlparse(url)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("invalid_feed_url")

    def _rss_audio_url(self, item: ET.Element) -> str | None:
        enclosure = item.find("enclosure")
        if enclosure is not None:
            url = enclosure.attrib.get("url", "").strip()
            media_type = enclosure.attrib.get("type", "")
            if url and (media_type.startswith("audio") or not media_type):
                return url
        media_content = item.find("media:content", self._NS)
        if media_content is not None:
            url = media_content.attrib.get("url", "").strip()
            if url:
                return url
        return None

    def _rss_image(self, channel: ET.Element) -> str:
        itunes_image = channel.find("itunes:image", self._NS)
        if itunes_image is not None:
            href = itunes_image.attrib.get("href", "").strip()
            if href:
                return href
        image_url = self._text(channel, "image/url")
        return image_url or "🎙️"

    def _rss_item_image(self, item: ET.Element) -> str | None:
        itunes_image = item.find("itunes:image", self._NS)
        if itunes_image is not None:
            href = itunes_image.attrib.get("href", "").strip()
            if href:
                return href
        return None

    def _atom_audio_url(self, entry: ET.Element) -> str | None:
        for link in entry.findall("atom:link", self._NS):
            rel = link.attrib.get("rel", "")
            href = link.attrib.get("href", "").strip()
            media_type = link.attrib.get("type", "")
            if href and (rel == "enclosure" or media_type.startswith("audio")):
                return href
        return None

    def _atom_link(self, element: ET.Element, rel: str) -> str | None:
        for link in element.findall("atom:link", self._NS):
            if link.attrib.get("rel", "alternate") == rel:
                href = link.attrib.get("href", "").strip()
                if href:
                    return href
        link = element.find("atom:link", self._NS)
        if link is not None:
            href = link.attrib.get("href", "").strip()
            if href:
                return href
        return None

    @staticmethod
    def _episode_id(source_url: str, audio_url: str, index: int) -> str:
        base = source_url or "feed"
        return f"rss-{abs(hash((base, audio_url, index)))}"

    @staticmethod
    def _normalize_date(value: str | None) -> str | None:
        if not value:
            return None
        try:
            return parsedate_to_datetime(value).isoformat()
        except Exception:
            pass
        try:
            normalized = value.replace("Z", "+00:00")
            return datetime.fromisoformat(normalized).isoformat()
        except Exception:
            return value

    @staticmethod
    def _normalize_lang(value: str | None) -> str | None:
        if not value:
            return None
        lang = value.strip().lower().replace("_", "-")
        return lang or None

    @staticmethod
    def _parse_duration(value: str | None) -> int:
        if not value:
            return 0
        raw = value.strip()
        if raw.isdigit():
            return int(raw)
        parts = raw.split(":")
        try:
            nums = [int(part) for part in parts]
        except ValueError:
            return 0
        if len(nums) == 3:
            h, m, s = nums
            return h * 3600 + m * 60 + s
        if len(nums) == 2:
            m, s = nums
            return m * 60 + s
        return 0

    def _text(self, element: ET.Element, path: str) -> str | None:
        node = element.find(path, self._NS)
        if node is None or node.text is None:
            return None
        text = node.text.strip()
        return text or None

    def _attr(self, element: ET.Element, path: str) -> str | None:
        node = element.find(path, self._NS)
        if node is None:
            return None
        for key in ("href", "url", "src"):
            value = node.attrib.get(key)
            if value and value.strip():
                return value.strip()
        if node.text and node.text.strip():
            return node.text.strip()
        return None
