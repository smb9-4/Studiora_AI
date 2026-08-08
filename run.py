"""
run_all.py — starts homepage, stu_model, and prof_model together.
====================================================================
Place this file directly inside your CHAT_GPT/ folder, next to the
homepage/, stu_model/, and prof_model/ subfolders (i.e. as a sibling of
those three, not inside any of them).

Run it with:
    python run_all.py

Your browser only ever needs http://localhost:5000 (the homepage) — the
other two ports (5001, 5002) are internal only; homepage's
ai_service_client.py / prof_ai_service_client.py already call them over
HTTP. This script just saves you from opening 3 terminals and starting
each `python app.py` by hand — it does not change how any of the three
apps talk to each other.

Press Ctrl+C once to stop all three together.
"""

import subprocess
import sys
import threading
import time
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

# (folder name relative to this file, short label used in the merged log, port — just for the startup banner)
SERVICES = [
    ("homepage",   "HOMEPAGE ", 5000),
    ("stu_model",  "STUDENT  ", 5001),
    ("prof_model", "PROFESSOR", 5002),
]

# ANSI colors so the three interleaved logs stay easy to tell apart in one
# terminal. If your terminal doesn't support ANSI colors, the codes just
# show up as harmless escape characters — set NO_COLOR = True below to
# disable them entirely.
NO_COLOR = False
COLORS = ["\033[36m", "\033[35m", "\033[33m"]  # cyan, magenta, yellow
RESET = "\033[0m"

processes = []
threads = []
shutting_down = threading.Event()


def stream_output(proc, label, color):
    """Reads a subprocess's stdout line by line and reprints it with a
    [LABEL] prefix, so all three services' logs interleave in one terminal
    instead of needing three separate windows."""
    prefix = f"{color}[{label}]{RESET} " if not NO_COLOR else f"[{label}] "
    try:
        for line in iter(proc.stdout.readline, ""):
            if not line:
                break
            print(f"{prefix}{line.rstrip()}", flush=True)
    except Exception:
        pass


def start_service(folder_name, label, port):
    folder = BASE_DIR / folder_name
    app_file = folder / "app.py"
    if not folder.is_dir():
        print(f"!! Folder not found: {folder} — check SERVICES paths in run_all.py")
        return None
    if not app_file.is_file():
        print(f"!! No app.py inside {folder} — check SERVICES paths in run_all.py")
        return None

    print(f">> Starting {label.strip()} (port {port}) from {folder}")
    # cwd=folder is the important part — each app's own relative paths
    # (its database file, chroma_db folder, uploads folder, etc.) resolve
    # against ITS OWN folder, exactly like when you run `python app.py`
    # from inside that folder by hand. Getting this wrong is what would
    # make an app write its database into the wrong place.
    proc = subprocess.Popen(
        [sys.executable, "app.py"],
        cwd=str(folder),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )
    return proc


def shutdown_all():
    if shutting_down.is_set():
        return
    shutting_down.set()
    print("\n>> Shutting down all services...")
    for proc, label in processes:
        if proc and proc.poll() is None:
            print(f"   stopping {label.strip()}...")
            proc.terminate()
    # give them a moment to exit cleanly before force-killing stragglers
    deadline = time.time() + 8
    for proc, label in processes:
        if not proc:
            continue
        remaining = max(0, deadline - time.time())
        try:
            proc.wait(timeout=remaining)
        except subprocess.TimeoutExpired:
            print(f"   {label.strip()} didn't stop in time, killing it")
            proc.kill()
    print(">> All stopped.")


def main():
    for i, (folder_name, label, port) in enumerate(SERVICES):
        proc = start_service(folder_name, label, port)
        color = COLORS[i % len(COLORS)]
        processes.append((proc, label))
        if proc:
            t = threading.Thread(target=stream_output, args=(proc, label, color), daemon=True)
            t.start()
            threads.append(t)

    if not any(proc for proc, _ in processes):
        print("!! Nothing started — fix the folder paths in run_all.py and try again.")
        return

    print("\n" + "=" * 60)
    print(" All available services starting. Visit: http://localhost:5000")
    print(" Press Ctrl+C to stop everything.")
    print("=" * 60 + "\n")

    try:
        # Watch for any service exiting unexpectedly (e.g. a crash, or a
        # missing dependency) — if one dies, bring the others down too
        # rather than leaving a half-working setup running silently.
        while True:
            time.sleep(1)
            for proc, label in processes:
                if proc and proc.poll() is not None:
                    print(f"\n!! {label.strip()} exited unexpectedly (code {proc.returncode}). "
                          f"Stopping the rest so you're not left with a partial setup.")
                    shutdown_all()
                    sys.exit(1)
    except KeyboardInterrupt:
        shutdown_all()


if __name__ == "__main__":
    main()