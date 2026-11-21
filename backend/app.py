from __future__ import annotations

import asyncio
import logging

import aiohttp
from aiohttp import web
from aiogram import Bot, Dispatcher

from .bot import BotHandlers
from .config import Settings
from .rss import RssPodcastService
from .security import InitDataValidator
from .web import WebApplicationFactory


class Application:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._validator = InitDataValidator(settings.bot_token, settings.init_data_max_age)
        self._dispatcher = Dispatcher()
        self._bot = Bot(token=settings.bot_token)
        BotHandlers(settings).register(self._dispatcher)

    async def run(self) -> None:
        logging.basicConfig(level=logging.INFO)
        if not self._settings.bot_token:
            raise RuntimeError("Переменная окружения BOT_TOKEN не задана")

        async with aiohttp.ClientSession() as session:
            rss_service = RssPodcastService(session)
            web_app = WebApplicationFactory(self._settings, self._validator, rss_service).create()
            runner = web.AppRunner(web_app)
            await runner.setup()
            site = web.TCPSite(runner, self._settings.host, self._settings.port)
            await site.start()
            logging.info("HTTP сервер запущен на %s:%s", self._settings.host, self._settings.port)

            try:
                await self._dispatcher.start_polling(self._bot)
            finally:
                await self._bot.session.close()
                await runner.cleanup()


def run() -> None:
    settings = Settings.from_env()
    asyncio.run(Application(settings).run())
