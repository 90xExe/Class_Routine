"""Synchronize the static faculty directory with the official VU CSE page."""

from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from lxml import html


ROOT = Path(__file__).resolve().parent
DESTINATION = ROOT / "assets" / "official-faculty.json"
FACULTY_URL = (
    "https://vu.edu.bd/academics/departments/"
    "computer-science-and-engineering/faculty-members"
)
TIMEOUT_SECONDS = 30
MINIMUM_EXPECTED_RECORDS = 20


def clean_text(node: object) -> str:
    if node is None:
        return ""
    if hasattr(node, "text_content"):
        value = node.text_content()
    else:
        value = str(node)
    return " ".join(value.split())


def first_by_class(card: object, class_name: str) -> str:
    nodes = card.xpath(
        './/*[contains(concat(" ", normalize-space(@class), " "),'
        f' " {class_name} ")][1]'
    )
    return clean_text(nodes[0]) if nodes else ""


def absolute_url(value: str) -> str:
    value = value.strip()
    return urllib.parse.urljoin(FACULTY_URL, value) if value else ""


def request_page() -> str:
    request = urllib.request.Request(
        FACULTY_URL,
        headers={
            "Accept": "text/html,application/xhtml+xml",
            "User-Agent": "VU-CSE-Faculty-Sync/1.0",
        },
    )
    last_error: Exception | None = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
                charset = response.headers.get_content_charset() or "utf-8"
                return response.read().decode(charset, "replace")
        except (urllib.error.HTTPError, urllib.error.URLError) as error:
            last_error = error
            if isinstance(error, urllib.error.HTTPError) and error.code < 500:
                break
        if attempt < 2:
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"Faculty directory request failed: {last_error}")


def parse_faculty(page_text: str) -> list[dict[str, str]]:
    tree = html.fromstring(page_text)
    cards = tree.xpath(
        '//*[contains(concat(" ", normalize-space(@class), " "),'
        ' " profile-card ")]'
    )
    faculty: list[dict[str, str]] = []
    seen: set[str] = set()

    for card in cards:
        name = first_by_class(card, "profile-name")
        designation = first_by_class(card, "profile-role")
        email = first_by_class(card, "profile-email")
        image_nodes = card.xpath(
            './/img[contains(concat(" ", normalize-space(@class), " "),'
            ' " profile-avatar ")]/@src'
        )
        profile_nodes = card.xpath('.//a[contains(@href, "/profile/")]/@href')
        image = absolute_url(str(image_nodes[0])) if image_nodes else ""
        profile = absolute_url(str(profile_nodes[0])) if profile_nodes else ""

        if urllib.parse.urlparse(image).netloc.lower() == "placehold.jp":
            image = ""
        if not name or not designation:
            continue

        identity = email.lower() or profile.lower() or name.lower()
        if identity in seen:
            continue
        seen.add(identity)
        faculty.append(
            {
                "name": name,
                "designation": designation,
                "email": email,
                "image": image,
                "profile": profile,
            }
        )

    if len(faculty) < MINIMUM_EXPECTED_RECORDS:
        raise RuntimeError(
            "The official faculty page returned only "
            f"{len(faculty)} valid records; existing data was kept."
        )
    return faculty


def synchronize() -> bool:
    faculty = parse_faculty(request_page())
    payload = {
        "updated": datetime.now(ZoneInfo("Asia/Dhaka")).date().isoformat(),
        "source": FACULTY_URL,
        "faculty": faculty,
    }

    if DESTINATION.exists():
        current = json.loads(DESTINATION.read_text(encoding="utf-8"))
        if current.get("faculty") == faculty:
            print(
                "No faculty changes detected: "
                f"{len(faculty)} profiles, "
                f"{sum(bool(item['image']) for item in faculty)} photos."
            )
            return False

    temporary = DESTINATION.with_suffix(".json.tmp")
    temporary.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    temporary.replace(DESTINATION)
    print(
        f"Updated {DESTINATION.relative_to(ROOT)}: "
        f"{len(faculty)} profiles, "
        f"{sum(bool(item['image']) for item in faculty)} photos."
    )
    return True


if __name__ == "__main__":
    try:
        synchronize()
    except Exception as error:
        print(f"Faculty sync failed: {error}", file=sys.stderr)
        raise SystemExit(1) from error
