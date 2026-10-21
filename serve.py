#!/usr/bin/env python3
"""Tiny static server with CORS headers to host the Tableau dashboard extension.

Usage:
    python serve.py [port]
Default port: 8188
Open the workbook in Tableau Desktop and the extension will load from
http://localhost:8188/index.html
"""
import sys, os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from functools import partial

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8188

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Tableau-*")
        self.send_header("Access-Control-Allow-Credentials", "true")
        self.send_header("Cache-Control", "no-store")

    def end_headers(self):
        self._cors()
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("[%s] %s\n" % (self.log_date_time_string(), fmt % args))

if __name__ == "__main__":
    handler = partial(Handler)
    httpd = ThreadingHTTPServer(("127.0.0.1", PORT), handler)
    print("Serving B2B extension on http://localhost:%d/index.html  (Ctrl+C to stop)" % PORT)
    print("Keep this window open while using the dashboard in Tableau Desktop.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
