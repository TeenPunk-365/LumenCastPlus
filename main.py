from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import logging
import os
import time
from pathlib import Path
from urllib.parse import parse_qsl

from aiohttp import web
from aiogram import Bot, Dispatcher, F
from aiogram.filters import CommandStart
from aiogram.types import KeyboardButton, Message, ReplyKeyboardMarkup, WebAppInfo
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")
WEBAPP_DIR = BASE_DIR / "webapp"

BOT_TOKEN = os.getenv("BOT_TOKEN", "").strip()
WEBAPP_URL = os.getenv("WEBAPP_URL", "").strip()
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8080"))
INIT_DATA_MAX_AGE = int(os.getenv("INIT_DATA_MAX_AGE", "86400"))

dp = Dispatcher()


def validate_init_data(init_data: str, bot_token: str, max_age: int = INIT_DATA_MAX_AGE) -> dict | None:
    if not init_data or not bot_token:
        return None
    try:
        parsed = dict(parse_qsl(init_data, keep_blank_values=True))
    except Exception:
        return None

    received_hash = parsed.pop("hash", None)
    if not received_hash:
        return None

    data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(parsed.items()))
    secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    calculated_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(calculated_hash, received_hash):
        return None

    try:
        auth_date = int(parsed.get("auth_date", "0"))
    except ValueError:
        return None
    if max_age and time.time() - auth_date > max_age:
        return None

    user_raw = parsed.get("user")
    if user_raw:
        try:
            parsed["user"] = json.loads(user_raw)
        except Exception:
            pass
    return parsed


@web.middleware
async def security_headers_middleware(request: web.Request, handler):
    if request.method == "OPTIONS":
        response = web.Response(status=204)
    else:
        response = await handler(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["X-Frame-Options"] = "ALLOWALL"
    origin = request.headers.get("Origin")
    if origin:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Vary"] = "Origin"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, X-Telegram-Init-Data, Authorization"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return response


@dp.message(CommandStart())
async def cmd_start(message: Message) -> None:
    if not WEBAPP_URL:
        await message.answer(
            "WEBAPP_URL не задан. Укажите публичный HTTPS URL в переменной окружения "
            "(например, https://<домен>/webapp/)."
        )
        return

    keyboard = ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text="Открыть Mini App", web_app=WebAppInfo(url=WEBAPP_URL))]],
        resize_keyboard=True,
    )
    await message.answer("Нажмите кнопку, чтобы открыть мини-приложение:", reply_markup=keyboard)


@dp.message(F.web_app_data)
async def on_web_app_data(message: Message) -> None:
    data = message.web_app_data.data if message.web_app_data else ""
    await message.answer(f"Данные из Mini App:\n{data}")


async def health_handler(request: web.Request) -> web.Response:
    return web.json_response({"status": "ok"})


def _extract_init_data(request: web.Request) -> str:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("tma "):
        return auth[4:].strip()
    return (
        request.headers.get("X-Telegram-Init-Data", "").strip()
        or request.query.get("initData", "").strip()
    )


async def validate_handler(request: web.Request) -> web.Response:
    init_data = _extract_init_data(request)
    if not init_data:
        init_data = (await request.text()).strip()
    validated = validate_init_data(init_data, BOT_TOKEN)
    if not validated:
        return web.json_response({"ok": False, "error": "invalid_init_data"}, status=401)
    user = validated.get("user")
    return web.json_response({"ok": True, "user": user, "auth_date": validated.get("auth_date")})


async def webapp_redirect(request: web.Request) -> web.Response:
    raise web.HTTPFound("/webapp/")


async def index_handler(request: web.Request) -> web.FileResponse:
    return web.FileResponse(BASE_DIR / "index.html")


def create_web_app() -> web.Application:
    app = web.Application(middlewares=[security_headers_middleware])
    app.router.add_get("/", health_handler)
    app.router.add_get("/health", health_handler)
    app.router.add_route("OPTIONS", "/api/validate", lambda r: web.Response(status=204))
    app.router.add_get("/api/validate", validate_handler)
    app.router.add_post("/api/validate", validate_handler)
    app.router.add_get("/app", index_handler)
    app.router.add_get("/webapp", webapp_redirect)
    app.router.add_static("/webapp/", path=str(WEBAPP_DIR), name="webapp", show_index=False)
    return app


async def main() -> None:
    logging.basicConfig(level=logging.INFO)
    if not BOT_TOKEN:
        raise RuntimeError("Переменная окружения BOT_TOKEN не задана")

    bot = Bot(token=BOT_TOKEN)
    app = create_web_app()

    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, HOST, PORT)
    await site.start()
    logging.info("HTTP сервер запущен на %s:%s", HOST, PORT)

    try:
        await dp.start_polling(bot)
    finally:
        await bot.session.close()
        await runner.cleanup()


if __name__ == "__main__":
    asyncio.run(main())
