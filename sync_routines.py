"""Synchronize the static routine data with the official VU student portal.

The script uses an authenticated student account, scans every semester/section
option published by the portal, and replaces routine.json only after a complete
successful scan. Credentials are read from environment variables or prompted
interactively; they are never written to disk or printed.
"""

from __future__ import annotations

import getpass
import http.cookiejar
import json
import os
import re
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
DEPARTMENT = os.getenv("VU_DEPARTMENT", "cse").strip().lower() or "cse"
DESTINATION_NAME = os.getenv("VU_ROUTINE_DESTINATION", "routine.json").strip()
DESTINATION = (ROOT / DESTINATION_NAME).resolve()
EXPECTED_PROGRAM = os.getenv("VU_EXPECTED_PROGRAM", "").strip()
if DESTINATION.parent != ROOT or DESTINATION.suffix.lower() != ".json":
    raise RuntimeError("VU_ROUTINE_DESTINATION must be a JSON file in the project root.")
BASE_URL = os.getenv("VU_BASE_URL", "http://160.187.25.3:8083").rstrip("/")
LOGIN_URL = f"{BASE_URL}/front/student/login"
ROUTINE_URL = f"{BASE_URL}/front/student/routine"
LOAD_URL = f"{ROUTINE_URL}/load"
TIMEOUT_SECONDS = 25
REQUEST_DELAY = float(os.getenv("VU_REQUEST_DELAY", "0.05"))

DAY_ORDER = [
    ("Saturday", "Sat"),
    ("Sunday", "Sun"),
    ("Monday", "Mon"),
    ("Tuesday", "Tue"),
    ("Wednesday", "Wed"),
    ("Thursday", "Thu"),
    ("Friday", "Fri"),
]

PORTAL_TIME_PATTERN = re.compile(r"\b(\d{1,2}:\d{2}\s*(?:AM|PM)?)\b", re.IGNORECASE)


def clean_text(node: object) -> str:
    if node is None:
        return ""
    if hasattr(node, "text_content"):
        value = node.text_content()
    else:
        value = str(node)
    return " ".join(value.split())


def normalize_portal_time(value: str) -> str:
    """Convert a portal time such as 01:15 PM or 13:15 to HH:MM."""
    compact = re.sub(r"\s+", " ", value.strip().upper())
    formats = ("%I:%M %p", "%H:%M") if compact.endswith(("AM", "PM")) else ("%H:%M",)
    for time_format in formats:
        try:
            return datetime.strptime(compact, time_format).strftime("%H:%M")
        except ValueError:
            continue
    raise RuntimeError(f"The portal returned an invalid routine time: {value!r}.")


def slots_from_table(table: object) -> list[dict[str, object]]:
    """Read every slot time directly from the official routine table header."""
    headers = table.xpath(".//thead//tr[1]/*[self::th or self::td]")
    slots: list[dict[str, object]] = []
    for header in headers:
        values = PORTAL_TIME_PATTERN.findall(clean_text(header))
        if len(values) < 2:
            continue
        slots.append(
            {
                "id": len(slots) + 1,
                "start": normalize_portal_time(values[-2]),
                "end": normalize_portal_time(values[-1]),
            }
        )

    if not slots:
        raise RuntimeError("Routine slot times were not found in the official table header.")
    for slot in slots:
        start = datetime.strptime(str(slot["start"]), "%H:%M")
        end = datetime.strptime(str(slot["end"]), "%H:%M")
        if end <= start:
            raise RuntimeError(f"The portal returned an invalid slot range: {slot}.")
    return slots


def request_text(
    opener: urllib.request.OpenerDirector,
    url: str,
    *,
    data: bytes | None = None,
    referer: str | None = None,
    ajax: bool = False,
) -> tuple[str, str]:
    headers = {
        "Accept": "*/*" if ajax else "text/html,application/xhtml+xml",
        "User-Agent": f"VU-{DEPARTMENT.upper()}-Routine-Sync/2.0",
    }
    if referer:
        headers["Referer"] = referer
    if ajax:
        headers["X-Requested-With"] = "XMLHttpRequest"

    request = urllib.request.Request(url, data=data, headers=headers)
    last_error: Exception | None = None

    for attempt in range(3):
        try:
            with opener.open(request, timeout=TIMEOUT_SECONDS) as response:
                charset = response.headers.get_content_charset() or "utf-8"
                return response.read().decode(charset, "replace"), response.geturl()
        except urllib.error.HTTPError as error:
            last_error = error
            if error.code < 500:
                break
        except urllib.error.URLError as error:
            last_error = error

        if attempt < 2:
            time.sleep(1.5 * (attempt + 1))

    raise RuntimeError(f"Portal request failed for {url}: {last_error}")


def authenticate(roll: str, password: str) -> urllib.request.OpenerDirector:
    cookie_jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(
        urllib.request.HTTPCookieProcessor(cookie_jar)
    )
    login_page, _ = request_text(opener, LOGIN_URL)
    tree = html.fromstring(login_page)
    tokens = tree.xpath(
        '//form[.//input[@name="roll"] and .//input[@name="password"]]'
        '//input[@name="_token"]/@value'
    )
    if not tokens:
        raise RuntimeError("The portal login form or CSRF token was not found.")

    payload = urllib.parse.urlencode(
        {"_token": tokens[0], "roll": roll, "password": password}
    ).encode("utf-8")
    request_text(opener, LOGIN_URL, data=payload, referer=LOGIN_URL)

    routine_page, final_url = request_text(opener, ROUTINE_URL, referer=LOGIN_URL)
    routine_tree = html.fromstring(routine_page)
    has_selectors = bool(
        routine_tree.xpath('//select[@name="semester_id"]')
        and routine_tree.xpath('//select[@name="section_id"]')
    )
    if not has_selectors or final_url.rstrip("/") == LOGIN_URL.rstrip("/"):
        raise RuntimeError("Portal sign-in failed. Check the student ID and password.")
    return opener


def option_catalog(page_text: str) -> tuple[list[dict[str, object]], list[dict[str, object]]]:
    tree = html.fromstring(page_text)

    def options(name: str) -> list[dict[str, object]]:
        result = []
        for option in tree.xpath(f'//select[@name="{name}"]/option[@value]'):
            value = str(option.get("value", "")).strip()
            label = clean_text(option)
            if value:
                result.append({"id": int(value), "label": label})
        return result

    semesters = options("semester_id")
    sections = options("section_id")
    if not semesters or not sections:
        raise RuntimeError("The official semester/section catalog was not found.")
    return semesters, sections


def program_from_fragment(page_text: str) -> str:
    tree = html.fromstring(page_text)
    info_nodes = tree.xpath(
        '//*[contains(concat(" ", normalize-space(@class), " "), " alert-info ")]'
    )
    if not info_nodes:
        return ""
    info_text = clean_text(info_nodes[0])
    return info_text.split("|", 1)[0].strip()


def parse_routine_fragment(
    page_text: str,
    semester: dict[str, object],
    section: dict[str, object],
) -> dict[str, object] | None:
    tree = html.fromstring(page_text)
    login_form = tree.xpath(
        '//form[.//input[@name="roll"] and .//input[@name="password"]]'
    )
    if login_form:
        raise RuntimeError("The portal session expired during synchronization.")

    tables = tree.xpath(
        '//div[contains(concat(" ", normalize-space(@class), " "),'
        ' " table-responsive ") and '
        'contains(concat(" ", normalize-space(@class), " "), " hidden-xs ")]'
        "//table"
    )
    if not tables:
        body = clean_text(tree)
        if "No routine found for the selected criteria" in body:
            return None
        raise RuntimeError(
            f"Unexpected portal response for {semester['label']}, "
            f"Section {section['label']}."
        )

    info_nodes = tree.xpath(
        '//*[contains(concat(" ", normalize-space(@class), " "), " alert-info ")]'
    )
    info_text = clean_text(info_nodes[0]) if info_nodes else ""
    if (
        str(semester["label"]) not in info_text
        or f"Section: {section['label']}" not in info_text
    ):
        raise RuntimeError(
            f"Portal returned mismatched data for {semester['label']}, "
            f"Section {section['label']}."
        )

    slots = slots_from_table(tables[0])
    source_days: dict[str, list[dict[str, object]]] = {}
    for row in tables[0].xpath(".//tbody/tr"):
        headers = row.xpath("./th[1]")
        if not headers:
            continue
        day_name = clean_text(headers[0])
        classes: list[dict[str, object]] = []

        cells = row.xpath("./td")
        if len(cells) != len(slots):
            raise RuntimeError(
                f"The official table has {len(cells)} class columns but "
                f"{len(slots)} slot headers for {semester['label']}, "
                f"Section {section['label']}."
            )
        for slot_index, cell in enumerate(cells, start=1):
            cards = cell.xpath(
                './/*[contains(concat(" ", normalize-space(@class), " "),'
                ' " event-card ")]'
            )
            for card in cards:
                code_nodes = card.xpath(
                    './/*[contains(concat(" ", normalize-space(@class), " "),'
                    ' " text-bold ")][1]'
                )
                title_nodes = card.xpath('.//div[contains(@style, "clear")]')
                teacher_nodes = card.xpath(
                    './/*[contains(concat(" ", normalize-space(@class), " "),'
                    ' " text-muted ")]'
                )
                room = ""
                for span in card.xpath(".//span"):
                    text = clean_text(span)
                    if re.match(r"^Room\s*:", text, re.IGNORECASE):
                        room = re.sub(
                            r"^Room\s*:\s*", "", text, flags=re.IGNORECASE
                        )
                        break

                code = clean_text(code_nodes[0]) if code_nodes else ""
                title = clean_text(title_nodes[0]) if title_nodes else ""
                teachers = [
                    clean_text(node)
                    for node in teacher_nodes
                    if clean_text(node)
                ]
                if not code or not title or not teachers or not room:
                    raise RuntimeError(
                        f"Incomplete class data in {semester['label']}, "
                        f"Section {section['label']}, {day_name}, slot {slot_index}."
                    )
                classes.append(
                    {
                        "slot": slot_index,
                        "start": slots[slot_index - 1]["start"],
                        "end": slots[slot_index - 1]["end"],
                        "code": code,
                        "title": title,
                        "teachers": teachers,
                        "room": room,
                        "type": "lab" if re.search(r"\blab\b", title, re.I) else "theory",
                    }
                )

        classes.sort(key=lambda item: (int(item["slot"]), str(item["code"])))
        source_days[day_name] = classes

    days = [
        {
            "name": day_name,
            "short": short_name,
            "classes": source_days.get(day_name, []),
        }
        for day_name, short_name in DAY_ORDER
    ]
    return {
        "semesterId": int(semester["id"]),
        "sectionId": int(section["id"]),
        "semester": str(semester["label"]),
        "section": str(section["label"]),
        "slots": slots,
        "days": days,
    }


def build_payload(
    semesters: list[dict[str, object]],
    sections: list[dict[str, object]],
    schedules: list[dict[str, object]],
    program: str,
    department: str,
    slots: list[dict[str, object]],
) -> dict[str, object]:
    now = datetime.now(ZoneInfo("Asia/Dhaka"))
    total_classes = sum(
        len(day["classes"])
        for schedule in schedules
        for day in schedule["days"]
    )
    scanned = len(semesters) * len(sections)
    return {
        "meta": {
            "department": department,
            "program": program,
            "timezone": "Asia/Dhaka",
            "source": "Varendra University official student routine portal",
            "updated": now.date().isoformat(),
            "lastSyncedAt": now.isoformat(timespec="seconds"),
            "coverage": {
                "loadedSchedules": len(schedules),
                "isComplete": True,
                "scannedCombinations": scanned,
                "totalClasses": total_classes,
                "note": (
                    f"All {scanned} official semester/section combinations were "
                    f"checked; {len(schedules)} published routines were found."
                ),
            },
        },
        "catalog": {"semesters": semesters, "sections": sections},
        "slots": slots,
        "schedules": schedules,
    }


def same_routine_data(
    current: dict[str, object], incoming: dict[str, object]
) -> bool:
    current_meta = current.get("meta", {})
    incoming_meta = incoming.get("meta", {})
    return (
        current_meta.get("department") == incoming_meta.get("department")
        and current_meta.get("program") == incoming_meta.get("program")
        and all(
            current.get(key) == incoming.get(key)
            for key in ("catalog", "slots", "schedules")
        )
    )


def synchronize(roll: str, password: str) -> bool:
    opener = authenticate(roll, password)
    routine_page, _ = request_text(opener, ROUTINE_URL)
    semesters, sections = option_catalog(routine_page)
    schedules: list[dict[str, object]] = []
    observed_slot_layouts: list[list[dict[str, object]]] = []
    program = ""

    for semester in semesters:
        for section in sections:
            query = urllib.parse.urlencode(
                {
                    "semester_id": semester["id"],
                    "section_id": section["id"],
                }
            )
            fragment, _ = request_text(
                opener,
                f"{LOAD_URL}?{query}",
                referer=ROUTINE_URL,
                ajax=True,
            )
            schedule = parse_routine_fragment(fragment, semester, section)
            if schedule is not None:
                schedules.append(schedule)
                observed_slot_layouts.append(schedule["slots"])
                if not program:
                    program = program_from_fragment(fragment)
            if REQUEST_DELAY:
                time.sleep(REQUEST_DELAY)

    schedules.sort(key=lambda item: (item["semesterId"], item["sectionId"]))
    if not schedules:
        raise RuntimeError(
            "The complete scan returned no published routines; existing data was kept."
        )
    if not observed_slot_layouts:
        raise RuntimeError("No official routine slot times were found; existing data was kept.")

    # The portal can roll out a new default routine gradually, leaving published
    # semester/section routines with different time bands. Preserve each
    # schedule's own official slots and keep the most common layout at the root
    # for older clients that only understand one shared slot list.
    slots = max(
        observed_slot_layouts,
        key=lambda candidate: sum(candidate == other for other in observed_slot_layouts),
    )

    program = program or EXPECTED_PROGRAM or DEPARTMENT.upper()
    if EXPECTED_PROGRAM:
        compact_expected = re.sub(r"[^a-z0-9]+", "", EXPECTED_PROGRAM.casefold())
        compact_program = re.sub(r"[^a-z0-9]+", "", program.casefold())
        if compact_expected not in compact_program:
            raise RuntimeError(
                f"The {DEPARTMENT.upper()} account returned program '{program}', "
                f"not the expected '{EXPECTED_PROGRAM}'. Existing data was kept."
            )

    payload = build_payload(
        semesters,
        sections,
        schedules,
        program,
        DEPARTMENT,
        slots,
    )
    if DESTINATION.exists():
        current = json.loads(DESTINATION.read_text(encoding="utf-8"))
        if same_routine_data(current, payload):
            print(
                f"No {DEPARTMENT.upper()} routine changes detected after scanning "
                f"{len(semesters) * len(sections)} combinations."
            )
            return False

    temporary = DESTINATION.with_suffix(".json.tmp")
    temporary.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    temporary.replace(DESTINATION)
    total_classes = payload["meta"]["coverage"]["totalClasses"]
    print(
        f"Updated {DESTINATION.name}: {len(schedules)} routines, "
        f"{total_classes} class entries for {program}."
    )
    return True

def main() -> None:
    roll = os.getenv("VU_STUDENT_ROLL", "").strip()
    password = os.getenv("VU_STUDENT_PASSWORD", "")

    if not roll:
        if not sys.stdin.isatty():
            raise RuntimeError("VU_STUDENT_ROLL is not configured.")
        roll = input("VU student ID / roll: ").strip()
    if not password:
        if not sys.stdin.isatty():
            raise RuntimeError("VU_STUDENT_PASSWORD is not configured.")
        password = getpass.getpass("VU student password: ")
    if not roll or not password:
        raise RuntimeError("Student ID and password are required.")

    synchronize(roll, password)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Routine sync failed: {error}", file=sys.stderr)
        raise SystemExit(1) from error
