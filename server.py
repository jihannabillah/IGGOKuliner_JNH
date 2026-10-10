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
import socket
import socketserver
import subprocess
import urllib.parse

PORT = int(os.environ.get("PORT", 3000))
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
DATA_FILE = os.path.join(DATA_DIR, "stamps.json")

# Pastikan folder dan file data stempel tersedia
os.makedirs(DATA_DIR, exist_ok=True)
if not os.path.exists(DATA_FILE):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump({}, f, indent=2)

def get_local_ips():
    ips = []
    # 1. Cek Wi-Fi / interface jaringan macOS & Linux
    for iface in ("en0", "en1", "wlan0", "eth0"):
        try:
            out = subprocess.check_output(["ipconfig", "getifaddr", iface], stderr=subprocess.DEVNULL).decode().strip()
            if out and out not in ips:
                ips.append(out)
        except Exception:
            pass

    # 2. Cek socket routing default
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.3)
        s.connect(("8.8.8.8", 80))
        sock_ip = s.getsockname()[0]
        s.close()
        if sock_ip and sock_ip != "127.0.0.1" and sock_ip not in ips:
            ips.append(sock_ip)
    except Exception:
        pass

    return ips

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

    def do_HEAD(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path in ("/api/stamps", "/api/ip", "/api/info"):
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            return
        super().do_HEAD()

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

        if parsed.path in ("/api/ip", "/api/info"):
            ips = get_local_ips()
            primary_ip = ips[0] if ips else "127.0.0.1"
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": True,
                "primary_ip": primary_ip,
                "all_ips": ips,
                "port": PORT
            }).encode("utf-8"))
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
        ips = get_local_ips()
        primary_ip = ips[0] if ips else "127.0.0.1"
        print("=" * 64)
        print("🚀 IGGO KULINER — LOCAL SERVER & REALTIME STAMP ENGINE")
        print("=" * 64)
        print(f"💻 Akses Komputer (Lokal) : http://localhost:{PORT}")
        print(f"📱 Akses HP (Wi-Fi / QR)  : http://{primary_ip}:{PORT}")
        if len(ips) > 1:
            print(f"   IP Tambahan            : {', '.join(ips[1:])}")
        print("-" * 64)
        print("📄 Halaman Tersedia:")
        print(f"  • Pendaftaran & Member  : http://localhost:{PORT}/index.html")
        print(f"  • Portal Kasir (Cap QR) : http://localhost:{PORT}/kasir.html")
        print(f"  • Pass Pelanggan        : http://localhost:{PORT}/pass.html?id=JNH-020")
        print(f"  • Portal Cetak Admin    : http://localhost:{PORT}/admin.html")
        print("=" * 64)
        print(f"📡 Real-time Sync API aktif di http://localhost:{PORT}/api/stamps")
        print("Tekan Ctrl+C untuk menghentikan server.")
        print("=" * 64)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer dihentikan.")
