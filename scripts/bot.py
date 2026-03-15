import asyncio
import hashlib
import json
import logging
import os
import random
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional
from urllib.parse import parse_qs, quote, urlparse

import aria2p
import bencodepy
from dotenv import load_dotenv
from supabase import Client, create_client


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("torrent-bot")


@dataclass
class TaskItem:
    magnet: Optional[str] = None
    torrent_file: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    thumbnail_url: Optional[str] = None
    minimum_required_tier: str = "NORMAL"
    duration_seconds: int = 60


@dataclass
class ParsedTorrentMeta:
    info_hash: Optional[str]
    name: Optional[str]


def load_env() -> None:
    load_dotenv(".env.local", override=False)


def required_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def create_supabase_admin_client() -> Client:
    url = required_env("NEXT_PUBLIC_SUPABASE_URL")
    key = required_env("SUPABASE_SERVICE_ROLE_KEY")
    return create_client(url, key)


def create_aria2_client() -> aria2p.API:
    host = os.getenv("ARIA2_RPC_HOST", "http://localhost")
    port = int(os.getenv("ARIA2_RPC_PORT", "6800"))
    secret = os.getenv("ARIA2_RPC_SECRET", "")
    timeout = float(os.getenv("ARIA2_RPC_TIMEOUT", "15"))

    client = aria2p.Client(host=host, port=port, secret=secret, timeout=timeout)
    return aria2p.API(client)


def parse_tasks_file(path_str: str) -> list[TaskItem]:
    path = Path(path_str)
    if not path.exists():
        raise FileNotFoundError(f"Task file not found: {path}")

    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        raise ValueError("Task file must contain a JSON array")

    tasks: list[TaskItem] = []
    for idx, row in enumerate(raw):
        if not isinstance(row, dict):
            raise ValueError(f"Task at index {idx} must be an object")

        task = TaskItem(
            magnet=row.get("magnet"),
            torrent_file=row.get("torrent_file"),
            title=row.get("title"),
            description=row.get("description"),
            thumbnail_url=row.get("thumbnail_url"),
            minimum_required_tier=(row.get("minimum_required_tier") or "NORMAL").upper(),
            duration_seconds=int(row.get("duration_seconds") or 60),
        )

        if not task.magnet and not task.torrent_file:
            raise ValueError(
                f"Task at index {idx} requires either magnet or torrent_file"
            )

        if task.minimum_required_tier not in {"NORMAL", "GENERAL", "VIP"}:
            raise ValueError(
                f"Task at index {idx} has invalid minimum_required_tier: {task.minimum_required_tier}"
            )

        if task.duration_seconds <= 0:
            raise ValueError(
                f"Task at index {idx} has invalid duration_seconds: {task.duration_seconds}"
            )

        tasks.append(task)

    return tasks


def extract_btih_from_magnet(magnet: str) -> ParsedTorrentMeta:
    parsed = urlparse(magnet)
    if parsed.scheme.lower() != "magnet":
        return ParsedTorrentMeta(info_hash=None, name=None)

    query = parse_qs(parsed.query)
    xt_values = query.get("xt", [])
    dn_values = query.get("dn", [])
    display_name = dn_values[0] if dn_values else None

    info_hash: Optional[str] = None
    for xt in xt_values:
        if xt.startswith("urn:btih:"):
            info_hash = xt.split("urn:btih:", 1)[1].strip().lower()
            break

    if info_hash and re.fullmatch(r"[a-f0-9]{40}", info_hash) is None:
        info_hash = None

    return ParsedTorrentMeta(info_hash=info_hash, name=display_name)


def parse_torrent_file_meta(torrent_file: str) -> ParsedTorrentMeta:
    torrent_path = Path(torrent_file)
    if not torrent_path.exists():
        raise FileNotFoundError(f"Torrent file not found: {torrent_file}")

    raw = torrent_path.read_bytes()
    decoded = bencodepy.decode(raw)

    info = decoded.get(b"info")
    if not isinstance(info, dict):
        return ParsedTorrentMeta(info_hash=None, name=torrent_path.stem)

    encoded_info = bencodepy.encode(info)
    info_hash = hashlib.sha1(encoded_info).hexdigest().lower()

    name_bytes = info.get(b"name")
    if isinstance(name_bytes, bytes):
        name = name_bytes.decode("utf-8", errors="replace")
    else:
        name = torrent_path.stem

    return ParsedTorrentMeta(info_hash=info_hash, name=name)


def infer_meta(task: TaskItem) -> ParsedTorrentMeta:
    if task.magnet:
        return extract_btih_from_magnet(task.magnet)
    if task.torrent_file:
        return parse_torrent_file_meta(task.torrent_file)
    return ParsedTorrentMeta(info_hash=None, name=None)


def normalize_name_for_lookup(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    sanitized = value.strip().lower()
    return sanitized or None


def already_registered(
    supabase: Client,
    info_hash: Optional[str],
    candidate_name: Optional[str],
) -> tuple[bool, str]:
    if info_hash:
        res = (
            supabase.table("videos")
            .select("id,title,info_hash")
            .eq("info_hash", info_hash)
            .limit(1)
            .execute()
        )
        if res.data:
            return True, f"matched info_hash={info_hash}"

    normalized_name = normalize_name_for_lookup(candidate_name)
    if normalized_name:
        # Fallback: conservative path/name check against video_source_url.
        res = (
            supabase.table("videos")
            .select("id,title,video_source_url")
            .ilike("video_source_url", f"%{normalized_name}%")
            .limit(1)
            .execute()
        )
        if res.data:
            return True, f"matched name fragment={normalized_name}"

    return False, ""


def add_to_aria2(api: aria2p.API, task: TaskItem, download_dir: str) -> aria2p.Download:
    options = {"dir": download_dir}

    if task.magnet:
        return api.add_magnet(task.magnet, options=options)

    if not task.torrent_file:
        raise RuntimeError("Task is missing both magnet and torrent_file")

    torrent_path = str(Path(task.torrent_file).resolve())
    return api.add_torrent(torrent_path, options=options)


async def wait_until_complete(
    api: aria2p.API,
    gid: str,
    poll_seconds: float,
) -> aria2p.Download:
    active_gid = gid
    while True:
        download = api.get_download(active_gid)

        followed_ids = list(getattr(download, "followed_by_ids", []) or [])
        if followed_ids:
            next_gid = str(followed_ids[0])
            if next_gid != active_gid:
                logger.info(
                    "Switching to followed download gid=%s (from gid=%s)",
                    next_gid,
                    active_gid,
                )
                active_gid = next_gid
                await asyncio.sleep(poll_seconds)
                continue

        if download.is_complete:
            return download

        if download.has_failed:
            raise RuntimeError(
                f"Download failed gid={active_gid} error_code={download.error_code} msg={download.error_message}"
            )

        progress = float(download.progress or 0.0)
        logger.info(
            "Downloading gid=%s progress=%.2f%% speed=%s",
            active_gid,
            progress,
            download.download_speed_string(),
        )

        await asyncio.sleep(poll_seconds)


def build_video_source_url(local_path: str, base_url: str) -> str:
    file_name = Path(local_path).name
    if not file_name:
        raise RuntimeError(f"Cannot derive filename from path: {local_path}")

    clean_base = base_url.rstrip("/")
    return f"{clean_base}/{quote(file_name)}"


def pick_primary_file(download: aria2p.Download) -> str:
    files = download.files
    if not files:
        raise RuntimeError(f"No files found for gid={download.gid}")

    # Pick the largest file as main content.
    biggest = max(files, key=lambda f: int(getattr(f, "length", 0) or 0))
    path_value = getattr(biggest, "path", None)
    if not path_value:
        raise RuntimeError(f"No file path found for gid={download.gid}")

    return str(path_value)


def upsert_video(
    supabase: Client,
    task: TaskItem,
    info_hash: Optional[str],
    source_url: str,
    fallback_title: Optional[str],
) -> None:
    title = (task.title or fallback_title or "Untitled Torrent Video").strip()
    if not title:
        title = "Untitled Torrent Video"

    description = (
        (task.description or "Imported from research BitTorrent pipeline").strip()
        or "Imported from research BitTorrent pipeline"
    )

    thumbnail = (task.thumbnail_url or "https://picsum.photos/seed/torrent-bot/640/360").strip()

    payload: dict[str, Any] = {
        "title": title,
        "description": description,
        "thumbnail_url": thumbnail,
        "video_source_url": source_url,
        "minimum_required_tier": task.minimum_required_tier,
        "duration_seconds": task.duration_seconds,
    }

    if info_hash:
        payload["info_hash"] = info_hash

    result = (
        supabase.table("videos")
        .upsert(payload, on_conflict="video_source_url")
        .execute()
    )

    if result.data is None and getattr(result, "error", None):
        raise RuntimeError(f"Supabase upsert failed: {result.error}")


async def run() -> None:
    load_env()

    tasks_path = os.getenv("TORRENT_TASKS_JSON", "scripts/torrent_tasks.json")
    download_dir = os.getenv("TORRENT_DOWNLOAD_DIR", "downloads")
    stream_base_url = required_env("STREAM_BASE_URL")

    poll_seconds = float(os.getenv("TORRENT_POLL_SECONDS", "5"))
    min_wait = float(os.getenv("TORRENT_MIN_WAIT_SECONDS", "1"))
    max_wait = float(os.getenv("TORRENT_MAX_WAIT_SECONDS", "2"))

    tasks = parse_tasks_file(tasks_path)
    supabase = create_supabase_admin_client()
    aria2 = create_aria2_client()

    logger.info("Loaded %d task(s)", len(tasks))

    imported = 0
    skipped = 0
    failed = 0

    for idx, task in enumerate(tasks, start=1):
        logger.info("Task %d/%d start", idx, len(tasks))

        try:
            meta = infer_meta(task)

            exists, reason = already_registered(
                supabase=supabase,
                info_hash=meta.info_hash,
                candidate_name=meta.name,
            )
            if exists:
                skipped += 1
                logger.info("Skip: already registered (%s)", reason)
                continue

            download = add_to_aria2(aria2, task, download_dir)
            logger.info("Queued gid=%s", download.gid)

            completed = await wait_until_complete(
                api=aria2,
                gid=download.gid,
                poll_seconds=poll_seconds,
            )

            local_file_path = pick_primary_file(completed)
            source_url = build_video_source_url(local_file_path, stream_base_url)

            upsert_video(
                supabase=supabase,
                task=task,
                info_hash=meta.info_hash,
                source_url=source_url,
                fallback_title=meta.name,
            )

            imported += 1
            logger.info("Imported gid=%s title=%s", completed.gid, task.title or meta.name)

            await asyncio.sleep(random.uniform(min_wait, max_wait))
        except Exception as exc:  # noqa: BLE001
            failed += 1
            logger.exception("Task failed: %s", exc)

    logger.info("Done: imported=%d skipped=%d failed=%d", imported, skipped, failed)

    if failed > 0:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(run())
