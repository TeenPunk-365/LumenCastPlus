from __future__ import annotations

from aiohttp import web

from .config import Settings
from .middlewares import security_headers_middleware
from .rss import RssPodcastService
from .security import InitDataValidator


class ApiController:
    def __init__(self, settings: Settings, validator: InitDataValidator, rss_service: RssPodcastService) -> None:
        self._settings = settings
        self._validator = validator
        self._rss_service = rss_service

    async def health(self, request: web.Request) -> web.Response:
        return web.json_response({"status": "ok"})

    async def index(self, request: web.Request) -> web.FileResponse:
        return web.FileResponse(self._settings.index_file)

    async def redirect_to_webapp(self, request: web.Request) -> web.Response:
        raise web.HTTPFound("/webapp/")

    async def validate(self, request: web.Request) -> web.Response:
        init_data = self._extract_init_data(request)
        if not init_data:
            init_data = (await request.text()).strip()
        result = self._validator.validate(init_data)
        if not result.ok:
            return web.json_response({"ok": False, "error": result.error}, status=401)
        return web.json_response({"ok": True, "user": result.user, "auth_date": result.auth_date})

    async def rss_feed(self, request: web.Request) -> web.Response:
        feed_url = request.query.get("url", "").strip()
        if not feed_url:
            return web.json_response({"ok": False, "error": "url_required"}, status=400)
        try:
            feed = await self._rss_service.fetch_feed(feed_url)
        except ValueError as exc:
            return web.json_response({"ok": False, "error": str(exc)}, status=400)
        except Exception:
            return web.json_response({"ok": False, "error": "feed_fetch_failed"}, status=502)
        return web.json_response({"ok": True, "feed": feed.to_dict()})

    @staticmethod
    def _extract_init_data(request: web.Request) -> str:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("tma "):
            return auth[4:].strip()
        return (
            request.headers.get("X-Telegram-Init-Data", "").strip()
            or request.query.get("initData", "").strip()
        )


class WebApplicationFactory:
    def __init__(self, settings: Settings, validator: InitDataValidator, rss_service: RssPodcastService) -> None:
        self._settings = settings
        self._controller = ApiController(settings, validator, rss_service)

    def create(self) -> web.Application:
        app = web.Application(middlewares=[security_headers_middleware])
        app.router.add_get("/", self._controller.health)
        app.router.add_get("/health", self._controller.health)
        app.router.add_get("/api/rss", self._controller.rss_feed)
        app.router.add_route("OPTIONS", "/api/validate", lambda r: web.Response(status=204))
        app.router.add_get("/api/validate", self._controller.validate)
        app.router.add_post("/api/validate", self._controller.validate)
        app.router.add_get("/app", self._controller.index)
        app.router.add_get("/webapp", self._controller.redirect_to_webapp)
        app.router.add_static("/webapp/", path=str(self._settings.webapp_dir), name="webapp", show_index=False)
        return app
