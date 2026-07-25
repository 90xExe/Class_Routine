"""Open the CSE routine as a local website.

Run:
    python app.py

The server uses only Python's standard library, opens the browser automatically,
and serves the exact same static files that can be published to GitHub Pages.
"""

from __future__ import annotations

import argparse
import contextlib
import threading
import webbrowser
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parent


class RoutineHandler(SimpleHTTPRequestHandler):
    """Serve the routine without stale development caches."""

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, format: str, *args: object) -> None:
        # Keep the window clean while still showing real errors.
        if args and str(args[1]).startswith(("4", "5")):
            super().log_message(format, *args)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Open the CSE routine website.")
    parser.add_argument("--port", type=int, default=8000, help="Preferred local port.")
    parser.add_argument(
        "--no-browser",
        action="store_true",
        help="Start the server without opening a browser tab.",
    )
    return parser.parse_args()


def create_server(preferred_port: int) -> ThreadingHTTPServer:
    handler = partial(RoutineHandler, directory=str(ROOT))
    try:
        return ThreadingHTTPServer(("127.0.0.1", preferred_port), handler)
    except OSError:
        # If the preferred port is busy, use a free local port automatically.
        return ThreadingHTTPServer(("127.0.0.1", 0), handler)


def main() -> None:
    args = parse_args()
    server = create_server(args.port)
    port = server.server_address[1]
    url = f"http://127.0.0.1:{port}/"

    print()
    print("VU CSE Routine Workspace is ready.")
    print(f"Opening: {url}")
    print("Press Ctrl+C to stop the local server.")
    print()

    if not args.no_browser:
        threading.Timer(0.35, webbrowser.open_new_tab, args=(url,)).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nRoutine server stopped.")
    finally:
        with contextlib.suppress(Exception):
            server.server_close()


if __name__ == "__main__":
    main()
