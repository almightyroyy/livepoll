#!/usr/bin/env python3
"""Helper: start a local server, run tests, then tear down."""
import subprocess, sys, time, socket, argparse, os, signal

def wait_for_port(port, timeout=15):
    start = time.time()
    while time.time() - start < timeout:
        try:
            with socket.create_connection(('localhost', port), timeout=1):
                return True
        except OSError:
            time.sleep(0.3)
    return False

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--server', required=True)
    parser.add_argument('--port', type=int, required=True)
    parser.add_argument('cmd', nargs=argparse.REMAINDER)
    args = parser.parse_args()

    srv = subprocess.Popen(args.server, shell=True, preexec_fn=os.setsid)
    if not wait_for_port(args.port):
        os.killpg(os.getpgid(srv.pid), signal.SIGTERM)
        sys.exit(1)

    cmd = [c for c in args.cmd if c != '--']
    ret = subprocess.run(cmd).returncode
    os.killpg(os.getpgid(srv.pid), signal.SIGTERM)
    sys.exit(ret)

if __name__ == '__main__':
    main()
