from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


@dataclass(frozen=True, slots=True)
class Settings:
    base_dir: Path
    webapp_dir: Path
    index_file: Path
    bot_token: str
    webapp_url: str
    host: str
    port: int
    init_data_max_age: int

    @classmethod
    def from_env(cls) -> "Settings":
        base_dir = BASE_DIR
        return cls(
            base_dir=base_dir,
            webapp_dir=base_dir / "webapp",
            index_file=base_dir / "index.html",
            bot_token=os.getenv("BOT_TOKEN", "").strip(),
            webapp_url=os.getenv("WEBAPP_URL", "").strip(),
            host=os.getenv("HOST", "0.0.0.0"),
            port=int(os.getenv("PORT", "8080")),
            init_data_max_age=int(os.getenv("INIT_DATA_MAX_AGE", "86400")),
        )
