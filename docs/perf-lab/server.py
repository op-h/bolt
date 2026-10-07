# Lab server: serves the project dir like GitHub Pages would (gzip text, max-age=600, no CSP),
# plus ?v=<variant> to splice a different <!-- perf --> region into index.html for A/B runs.
import gzip, http.server, json, mimetypes, os, re, sys, urllib.parse
LAB = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(LAB, '..', '..'))   # project root = two levels up from docs/perf-lab/
VARIANTS = {}
if os.path.exists(os.path.join(LAB, 'variants.json')): VARIANTS = json.load(open(os.path.join(LAB, 'variants.json')))
GZ = ('text/', 'application/javascript', 'application/json', 'image/svg+xml', 'font/ttf')
class H(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        u = urllib.parse.urlparse(self.path); q = urllib.parse.parse_qs(u.query)
        p = urllib.parse.unquote(u.path)
        if p.startswith('/__lab/'): f = os.path.join(LAB, p[7:])
        else: f = os.path.join(ROOT, p.lstrip('/') or 'index.html')
        if os.path.isdir(f): f = os.path.join(f, 'index.html')
        if not os.path.isfile(f): self.send_response(404); self.end_headers(); return
        ref = urllib.parse.parse_qs(urllib.parse.urlparse(self.headers.get('Referer', '')).query)
        vname = q.get('v', ref.get('v', ['']))[0]
        spec = VARIANTS.get(vname, {})
        rel = os.path.relpath(f, ROOT)
        if rel in spec.get('serve', {}): f = spec['serve'][rel]
        data = open(f, 'rb').read()
        for a, b in spec.get('patch', {}).get(rel, []):
            assert a.encode() in data, a
            data = data.replace(a.encode(), b.encode())
        if os.path.basename(f) == 'index.html' and not p.startswith('/__lab/'):
            v = q.get('v', [''])[0]
            s = data.decode()
            if v in VARIANTS:
                spec = VARIANTS[v]
                s = re.sub(r'<!-- perf:start -->.*?<!-- perf:end -->', lambda m: '<!-- perf:start -->' + spec.get('perf', '') + '<!-- perf:end -->', s, flags=re.S)
                for a, b in spec.get('replace', []): s = s.replace(a, b)
            data = s.encode()
        ct = mimetypes.guess_type(f)[0] or 'application/octet-stream'
        if f.endswith('.woff2'): ct = 'font/woff2'
        self.send_response(200); self.send_header('Content-Type', ct + ('; charset=utf-8' if ct.startswith('text/') or 'javascript' in ct else ''))
        self.send_header('Cache-Control', 'max-age=600')
        if ct.startswith(GZ) or ct in GZ:
            data = gzip.compress(data, 9); self.send_header('Content-Encoding', 'gzip')
        self.send_header('Content-Length', str(len(data))); self.end_headers(); self.wfile.write(data)
http.server.ThreadingHTTPServer(('127.0.0.1', int(sys.argv[1])), H).serve_forever()
