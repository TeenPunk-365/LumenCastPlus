# LumenCastPlus

Telegram Mini App (Python backend + static frontend) в стиле подкастов.

## Структура

- `main.py` — точка входа
- `backend/` — Python backend (config, security, middlewares, bot handlers, web API, app bootstrap)
- `index.html` — фронтенд (корень, подходит для GitHub Pages)
- `webapp/styles.css` — стили
- `webapp/js/` — JS-модули UI

## Запуск

1. `pip install -r requirements.txt`
2. Скопируйте `.env.example` в `.env` и задайте `BOT_TOKEN`, `WEBAPP_URL`
3. `python main.py`

Mini App: `/webapp/` (локально `http://localhost:8080/webapp/`). Для GitHub Pages используется корневой `index.html`.

## RSS

- При старте приложение загружает подборку бесплатных RSS-подкастов, преимущественно на русском: Радио-Т, Завтракаст, После пары, В голове у музыканта, Соль земли (+ Planet Money как англ. пример).
- Во вкладке «Поиск» можно выбрать подкаст из подборки или добавить свой RSS/Atom URL; язык показывается в карточке/описании подкаста.
- Backend endpoint: `GET /api/rss?url=<feed_url>` — парсит RSS/Atom, возвращает эпизоды с `audio_url` и `language`.
- Эпизоды воспроизводятся через HTML5 Audio; добавленные пользователем RSS-ленты сохраняются в `localStorage`.
