#!/usr/bin/env bash
# Render Build Script for Craftify Django 5 + DRF Production Backend
set -o errexit

pip install --upgrade pip
pip install -r requirements/prod.txt

python manage.py collectstatic --no-input
python manage.py migrate --no-input
