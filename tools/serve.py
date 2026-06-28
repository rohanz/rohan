#!/usr/bin/env python3
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse
import os


ROOT = Path(__file__).resolve().parents[1]


class SpaFallbackHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        translated = super().translate_path(path)
        try:
            return str(ROOT / Path(translated).resolve().relative_to(Path.cwd().resolve()))
        except ValueError:
            return str(ROOT / path.lstrip("/"))

    def send_head(self):
        requested_path = Path(self.translate_path(self.path.split("?", 1)[0].split("#", 1)[0]))

        if requested_path.exists():
            return super().send_head()

        route = self.path.split("?", 1)[0].split("#", 1)[0]
        is_extensionless = not Path(route).suffix
        if is_extensionless:
            self.path = "/index.html"
            return super().send_head()

        return super().send_head()


def main():
    parser = argparse.ArgumentParser(description="Serve the portfolio locally with SPA route fallback.")
    parser.add_argument("port", nargs="?", type=int, default=8080)
    args = parser.parse_args()

    os.chdir(ROOT)
    server = ThreadingHTTPServer(("127.0.0.1", args.port), SpaFallbackHandler)
    print(f"Serving {ROOT} at http://127.0.0.1:{args.port}/")
    print("SPA fallback enabled for extensionless routes.")
    server.serve_forever()


if __name__ == "__main__":
    main()
