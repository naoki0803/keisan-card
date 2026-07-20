#!/usr/bin/env python3
"""同一Wi-Fi内のスマホ・タブレットから動作確認するためのHTTPSサーバー。

音声認識(マイク)は HTTPS か localhost でしか動かないため、
LAN内の他端末から試すときはこのスクリプトを使う:

    python3 serve-local.py

初回起動時に自己署名証明書(cert.pem / key.pem)を自動生成する。
スマホ側では初回アクセス時に証明書の警告が出るので、
「詳細を表示」→「このWebサイトを閲覧」(iOS) / 「詳細設定」→「アクセスする」(Android)
で進めばよい。
"""
import http.server
import socket
import ssl
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).parent
CERT = HERE / 'cert.pem'
KEY = HERE / 'key.pem'
PORT = 8443


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        return s.getsockname()[0]
    except OSError:
        return '127.0.0.1'
    finally:
        s.close()


def ensure_cert(ip):
    if CERT.exists() and KEY.exists():
        return
    print('自己署名証明書を生成します…')
    subprocess.run(
        [
            'openssl', 'req', '-x509', '-newkey', 'rsa:2048',
            '-keyout', str(KEY), '-out', str(CERT),
            '-days', '365', '-nodes',
            '-subj', '/CN=keisan-card.local',
            '-addext', f'subjectAltName=IP:{ip},IP:127.0.0.1,DNS:localhost',
        ],
        check=True,
        capture_output=True,
    )


def main():
    ip = lan_ip()
    ensure_cert(ip)

    handler = http.server.SimpleHTTPRequestHandler
    httpd = http.server.ThreadingHTTPServer(('0.0.0.0', PORT), handler)
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(CERT, KEY)
    httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)

    print()
    print('  けいさんカード ローカルサーバー起動!')
    print(f'    この Mac から:   https://localhost:{PORT}')
    print(f'    スマホ・iPadから: https://{ip}:{PORT}')
    print()
    print('  ※ スマホ側で証明書の警告が出たら「詳細」から進んでください')
    print('  ※ 終了は Ctrl+C')
    print()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\n終了しました')
        sys.exit(0)


if __name__ == '__main__':
    main()
