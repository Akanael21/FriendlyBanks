#!/usr/bin/env bash
# exit on error
set -o errexit

echo "Running migrations..."
python manage.py migrate

echo "Recalculating all Berry Points..."
python manage.py recalculate_berry_points

echo "Starting Gunicorn server..."
gunicorn config.wsgi:application