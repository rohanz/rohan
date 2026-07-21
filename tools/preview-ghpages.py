#!/usr/bin/env python3
"""Static server that mimics GitHub Pages: unknown paths get /404.html."""
import http.server
import os
import sys

ROOT = sys.argv[1] if len(sys.argv) > 1 else '.'
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 4200
os.chdir(ROOT)


class GHPagesHandler(http.server.SimpleHTTPRequestHandler):
    def send_error(self, code, message=None, explain=None):
        if code == 404 and os.path.isfile('404.html'):
            with open('404.html', 'rb') as f:
                body = f.read()
            self.send_response(404)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            try:
                self.wfile.write(body)
            except BrokenPipeError:
                pass
            return
        super().send_error(code, message, explain)

    def log_message(self, *args):
        pass


http.server.ThreadingHTTPServer(('', PORT), GHPagesHandler).serve_forever()
