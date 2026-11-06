#!/usr/bin/env python3
"""
Serves the game folder for testing in a browser, with caching turned off so every reload
picks up edited scripts and content (plain `python -m http.server` lets the browser keep
old copies of scripts).

    python tools/serve.py          then open http://localhost:8000
    python tools/serve.py 8765     another port
"""
import http.server
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class NoCache(http.server.SimpleHTTPRequestHandler):
    # fonts by their real types, whatever the machine's registry says
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, ".woff": "font/woff", ".woff2": "font/woff2"}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        if args and str(args[1]).startswith(("4", "5")):
            super().log_message(fmt, *args)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    print(f"Serving {ROOT} at http://localhost:{port}  (Ctrl+C to stop)")
    http.server.ThreadingHTTPServer(("", port), NoCache).serve_forever()
