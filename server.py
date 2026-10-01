#!/usr/bin/env python3
"""
==============================================================
IGGO KULINER — LOCAL CRM & STAMPS REALTIME SERVER
Port: 3000
==============================================================
Menyediakan static web server sekaligus Centralized JSON API
agar penambahan cap di Kasir langsung tersinkronisasi detik itu juga
ke HP Pelanggan (pass.html) saat scan QR Code.
"""

import http.server
import json
import os
import socketserver
import urllib.parse

PORT = 3000
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
DATA_FILE = os.path.join(DATA_DIR, "stamps.json")

# Pastikan folder dan file data stempel tersedia
os.makedirs(DATA_DIR, exist_ok=True)
if not os.path.exists(DATA_FILE):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump({}, f, indent=2)

def read_stamps():
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}

def write_stamps(data):
    try:
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        print("[ERROR] Gagal menulis ke stamps.json:", e)

class IGGORequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def end_headers(self):
        # Enable CORS & No-Cache untuk API
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/stamps":
            query = urllib.parse.parse_qs(parsed.query)
            member_id = query.get("id", [""])[0].strip().lower()
            stamps = read_stamps()

            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()

            if member_id:
                count = stamps.get(member_id, None)
                res = {"success": True, "id": member_id, "cap": count}
            else:
                res = {"success": True, "stamps": stamps}

            self.wfile.write(json.dumps(res).encode("utf-8"))
            return

        # Fallback to standard static file server
        super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/stamps":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length).decode("utf-8") if length > 0 else "{}"
            try:
                payload = json.loads(body)
            except Exception:
                payload = {}

            member_id = str(payload.get("id", "")).strip().lower()
            action = payload.get("action", "add")  # 'add', 'set', 'reset'
            val = payload.get("value", 1)

            stamps = read_stamps()
            current_val = stamps.get(member_id, 0)

            if member_id:
                if action == "add":
                    current_val = (current_val or 0) + 1
                    if current_val > 10:
                        current_val = 1
                    stamps[member_id] = current_val
                elif action == "set":
                    stamps[member_id] = int(val)
                    current_val = int(val)
                elif action == "reset":
                    stamps.pop(member_id, None)
                    current_val = 0

                write_stamps(stamps)
                print(f"[KASIR SYNC] ID: {member_id} | Action: {action} | Total Cap: {current_val}")

            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": True,
                "id": member_id,
                "cap": current_val
            }).encode("utf-8"))
            return

        super().do_POST()

class ThreadedHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True

if __name__ == "__main__":
    server_address = ("", PORT)
    with ThreadedHTTPServer(server_address, IGGORequestHandler) as httpd:
        print(f"🚀 IGGO Kuliner Server aktif di port {PORT} (http://localhost:{PORT})")
        print(f"📡 Real-time Sync API tersedia di /api/stamps")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer dihentikan.")
