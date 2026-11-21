from __future__ import annotations

from aiogram import Dispatcher, F
from aiogram.filters import CommandStart
from aiogram.types import KeyboardButton, Message, ReplyKeyboardMarkup, WebAppInfo

from .config import Settings


class BotHandlers:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def register(self, dp: Dispatcher) -> None:
        dp.message.register(self.cmd_start, CommandStart())
        dp.message.register(self.on_web_app_data, F.web_app_data)

    async def cmd_start(self, message: Message) -> None:
        if not self._settings.webapp_url:
            await message.answer(
                "WEBAPP_URL не задан. Укажите публичный HTTPS URL в переменной окружения "
                "(например, https://<домен>/webapp/)."
            )
            return

        keyboard = ReplyKeyboardMarkup(
            keyboard=[[KeyboardButton(text="Открыть Mini App", web_app=WebAppInfo(url=self._settings.webapp_url))]],
            resize_keyboard=True,
        )
        await message.answer("Нажмите кнопку, чтобы открыть мини-приложение:", reply_markup=keyboard)

    @staticmethod
    async def on_web_app_data(message: Message) -> None:
        data = message.web_app_data.data if message.web_app_data else ""
        await message.answer(f"Данные из Mini App:\n{data}")
