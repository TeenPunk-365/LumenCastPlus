# LumenCastPlus

Telegram Mini App (Python backend + static frontend) в стиле подкастов.

## Структура

- `main.py` — aiogram бот + aiohttp API/раздача статики
- `index.html` — фронтенд (корень, подходит для GitHub Pages)
- `webapp/styles.css` — стили
- `webapp/js/` — JS-модули UI

## Запуск

1. `pip install -r requirements.txt`
2. Скопируйте `.env.example` в `.env` и задайте `BOT_TOKEN`, `WEBAPP_URL`
3. `python main.py`

Mini App: `/webapp/` (локально `http://localhost:8080/webapp/`). Для GitHub Pages используется корневой `index.html`.
