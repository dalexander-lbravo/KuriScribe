import os
import sys
import time
import socket
import threading
import webbrowser
from server import app

def find_free_port(default_port=5000):
    """Encuentra un puerto libre disponible en el sistema local."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        sock.bind(('127.0.0.1', default_port))
        sock.close()
        return default_port
    except OSError:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
        sock.close()
        return port

def run_server(port):
    """Inicia el servidor Flask en segundo plano."""
    app.run(host='127.0.0.1', port=port, debug=False, threaded=True)

def main():
    port = find_free_port(5000)
    url = f"http://127.0.0.1:{port}"

    # Iniciar servidor Flask en hilo independiente
    server_thread = threading.Thread(target=run_server, args=(port,), daemon=True)
    server_thread.start()

    time.sleep(0.8)
    print(f"==================================================")
    print(f" 🦔 KuriScribe Desktop iniciado correctamente")
    print(f" Servidor activo en: {url}")
    print(f"==================================================")

    # Abrir en el navegador predeterminado del sistema
    webbrowser.open(url)

    try:
        while True:
            time.sleep(1)
    except (KeyboardInterrupt, SystemExit):
        sys.exit(0)

if __name__ == '__main__':
    main()
