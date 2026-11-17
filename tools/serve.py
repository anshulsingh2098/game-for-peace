"""Local development server. Same as `python -m http.server`, but tells the browser never to cache,
so edits always show up on a normal refresh.
Usage: python tools/serve.py [port]      (default 8765; serves the project folder)"""
import http.server, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
    def log_message(self, *a): pass

if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    port = int(args[0]) if args else 8765
    lan = '--lan' in sys.argv                                    # --lan: also reachable from a phone on the same wifi
    host = '0.0.0.0' if lan else '127.0.0.1'
    print(f'Serving {ROOT} at http://localhost:{port}/  (Ctrl+C to stop)', flush=True)
    if lan:
        import socket
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.connect(('10.255.255.255', 1)); ip = s.getsockname()[0]; s.close()
            print(f'On the same wifi, a phone can open http://{ip}:{port}/next.html?play  (anyone on your network can reach this while it runs)', flush=True)
        except OSError:
            print('Could not work out this computer\'s address: look it up in your network settings.', flush=True)
    http.server.ThreadingHTTPServer((host, port), Handler).serve_forever()
