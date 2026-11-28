import argparse
import importlib.util
import json
import os
import signal
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def check_ports(mobile_lan=False):
    for port in ((8000, 8001, 8002) if mobile_lan else (8000, 8001)):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
            try:
                probe.bind(('127.0.0.1', port))
            except OSError:
                raise RuntimeError(f'Port {port} is busy. Stop the existing service before running this command.') from None


def start_service(module, port, host='127.0.0.1'):
    return subprocess.Popen(
        [sys.executable, '-m', 'uvicorn', module, '--host', host, '--port', str(port), '--no-proxy-headers'],
        cwd=ROOT,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == 'nt' else 0,
    )


def wait_for_tts(process, api_key, provider):
    deadline = time.monotonic() + 45
    request = urllib.request.Request('http://127.0.0.1:8001/health', headers={'Authorization': 'Bearer ' + api_key})
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError('TTS stopped during startup. See its error output above.')
        try:
            with opener.open(request, timeout=2) as response:
                health = json.load(response)
                if health.get('status') == 'ok' and health.get('provider') == provider and health.get('voices'):
                    return
        except urllib.error.HTTPError:
            raise RuntimeError('TTS health check was rejected. Check TTS_API_KEY and restart both services.') from None
        except (urllib.error.URLError, TimeoutError):
            pass
        time.sleep(0.25)
    raise RuntimeError('TTS did not become ready within 45 seconds.')


def stop_services(processes):
    for process in reversed(processes):
        if process.poll() is None:
            process.terminate()
    for process in reversed(processes):
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()


def main(argv=None):
    parser = argparse.ArgumentParser(description='Run local Admin backend and TTS.')
    parser.add_argument('--mobile-lan', action='store_true', help='Also expose the public-only mobile API on LAN port 8002. Admin/TTS remain loopback-only.')
    arguments = parser.parse_args(argv)
    processes = []
    previous_handlers = {}

    def interrupted(signum, frame):
        raise KeyboardInterrupt

    try:
        for dependency in ('dotenv', 'uvicorn', 'lameenc'):
            if importlib.util.find_spec(dependency) is None:
                raise RuntimeError('Missing dependencies. Run Backend/.venv/Scripts/python.exe -m pip install -r Backend/requirements-local-tts.txt from the repository root.')
        from app.core.config import settings

        provider = settings.get('TTS_PROVIDER', 'edge-tts').strip().lower()
        if provider not in {'edge-tts', 'windows-local', 'google'}:
            raise RuntimeError('Set TTS_PROVIDER to edge-tts, windows-local, or google.')
        if provider == 'windows-local' and os.name != 'nt':
            raise RuntimeError('Windows speech synthesis requires Windows.')
        if provider == 'edge-tts' and importlib.util.find_spec('edge_tts') is None:
            raise RuntimeError('Install edge-tts with python -m pip install -r requirements-local-tts.txt.')
        if settings.get('TTS_ENDPOINT') not in {'http://127.0.0.1:8001/speech', 'http://localhost:8001/speech'}:
            raise RuntimeError('Set TTS_ENDPOINT=http://127.0.0.1:8001/speech in Backend/.env.')
        if not settings.get('TTS_API_KEY'):
            raise RuntimeError('Set a random TTS_API_KEY in Backend/.env before starting.')
        check_ports(arguments.mobile_lan)
        for signal_number in (signal.SIGINT, signal.SIGTERM):
            previous_handlers[signal_number] = signal.signal(signal_number, interrupted)
        print('Starting local TTS on 127.0.0.1:8001...', flush=True)
        processes.append(start_service('local_tts.server:app', 8001))
        wait_for_tts(processes[0], settings['TTS_API_KEY'], provider)
        print('TTS ready. Starting backend on 127.0.0.1:8000. Press Ctrl+C to stop both.', flush=True)
        processes.append(start_service('app.main:app', 8000))
        if arguments.mobile_lan:
            processes.append(start_service('app.mobile_main:app', 8002, '0.0.0.0'))
            print('Public mobile API: http://<your-LAN-IP>:8002. Admin and TTS are NOT exposed on LAN.', flush=True)
        while True:
            for name, process in zip(('TTS', 'Backend', 'Public mobile API'), processes):
                if process.poll() is not None:
                    raise RuntimeError(f'{name} exited with code {process.returncode}. Stopping the other service.')
            time.sleep(0.5)
    except KeyboardInterrupt:
        print('\nStopping backend and TTS...', flush=True)
        return 0
    except (RuntimeError, OSError, ValueError) as error:
        print(f'Error: {error}', file=sys.stderr)
        return 1
    finally:
        for signal_number in previous_handlers:
            signal.signal(signal_number, signal.SIG_IGN)
        stop_services(processes)
        for signal_number, handler in previous_handlers.items():
            signal.signal(signal_number, handler)


if __name__ == '__main__':
    sys.exit(main())
