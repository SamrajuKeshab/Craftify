#!/usr/bin/env python
"""Craftify Django command-line administrative utility."""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv


def main():
    """Run administrative tasks."""
    base_dir = Path(__file__).resolve().parent
    load_dotenv(base_dir / ".env")
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Make sure your virtual environment is activated "
            "and dependencies from requirements/dev.txt are installed."
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
