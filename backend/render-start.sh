#!/usr/bin/env bash
# exit on error
set -o errexit

echo "Running migrations..."
python manage.py migrate

echo "Starting Gunicorn server..."
gunicorn config.wsgi:application