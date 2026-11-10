"""Test helper: a statement reader child that dies abruptly (as on a memory/CPU limit)."""
import os
import signal

os.kill(os.getpid(), signal.SIGKILL)
