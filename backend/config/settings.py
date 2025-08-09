# Fichier : config/settings.py

import os
from pathlib import Path
from dotenv import load_dotenv

# --- CHEMIN DE BASE ET CHARGEMENT DES VARIABLES D'ENVIRONNEMENT ---
# C'est la première chose à faire pour que le reste du fichier y ait accès.
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')


# ==============================================================================
# PARAMÈTRES DE SÉCURITÉ (lus depuis le fichier .env)
# ==============================================================================

# La clé secrète est OBLIGATOIRE. Si elle n'est pas dans .env, le serveur ne démarrera pas.
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY')

# Le mode DEBUG est False par défaut (plus sécurisé). Mettez DJANGO_DEBUG=True dans .env pour développer.
DEBUG = os.environ.get('DJANGO_DEBUG', 'False') == 'True'

# Liste des noms de domaine autorisés, lus depuis .env.
# Exemple dans .env: DJANGO_ALLOWED_HOSTS=www.friendlybanks.com,api.friendlybanks.com
ALLOWED_HOSTS = os.environ.get('DJANGO_ALLOWED_HOSTS', '127.0.0.1,localhost').split(',')


# ==============================================================================
# CONFIGURATION CENTRALE DE L'APPLICATION
# ==============================================================================

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
    'api',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    # WhiteNoise doit être placé juste après le SecurityMiddleware.
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'
WSGI_APPLICATION = 'config.wsgi.application'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
AUTH_USER_MODEL = 'api.User'


# ==============================================================================
# BASE DE DONNÉES (identifiants lus depuis .env)
# ==============================================================================

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('DB_NAME'),
        'USER': os.environ.get('DB_USER'),
        'PASSWORD': os.environ.get('DB_PASSWORD'),
        'HOST': os.environ.get('DB_HOST', 'localhost'),
        'PORT': os.environ.get('DB_PORT', '5432'),
    }
}


# ==============================================================================
# FICHIERS STATIQUES (CSS, JS) ET MÉDIA (UPLOADS)
# ==============================================================================

# URL pour accéder aux fichiers statiques
STATIC_URL = 'static/'
# Dossier où `collectstatic` rassemblera tous les fichiers statiques pour la production.
STATIC_ROOT = BASE_DIR / 'staticfiles'
# Méthode de stockage recommandée pour WhiteNoise, qui gère la compression et le cache.
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# URL pour accéder aux fichiers uploadés par les utilisateurs
MEDIA_URL = '/media/'
# Dossier où les fichiers uploadés seront stockés
MEDIA_ROOT = BASE_DIR / 'mediafiles'


# ==============================================================================
# CONFIGURATIONS D'APPLICATIONS TIERCES (CORS, REST FRAMEWORK)
# ==============================================================================

# CORS : Autorise les requêtes provenant de votre frontend.
CORS_ALLOWED_ORIGINS = os.environ.get('CORS_ALLOWED_ORIGINS', 'http://localhost:3000,http://127.0.0.1:3000').split(',')
CORS_ALLOW_CREDENTIALS = True

# Django REST Framework
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
}


# ==============================================================================
# CONFIGURATION DES EMAILS (identifiants lus depuis .env)
# ==============================================================================

# Par défaut, affiche les emails dans la console. Surchargé par les variables de .env.
EMAIL_BACKEND = os.environ.get('EMAIL_BACKEND', 'django.core.mail.backends.console.EmailBackend')
EMAIL_HOST = os.environ.get('EMAIL_HOST')
EMAIL_PORT = int(os.environ.get('EMAIL_PORT', 587))
EMAIL_USE_TLS = os.environ.get('EMAIL_USE_TLS', 'True') == 'True'
EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD')
# Assure que si EMAIL_HOST_USER n'est pas défini, le programme ne crashe pas.
DEFAULT_FROM_EMAIL = f"Friendly Banks <{os.environ.get('EMAIL_HOST_USER', 'noreply@friendlybanks.com')}>"
SERVER_EMAIL = DEFAULT_FROM_EMAIL


# ==============================================================================
# INTERNATIONALISATION ET LOGGING
# ==============================================================================

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'fr-fr'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {'format': '{levelname} {asctime} {module}: {message}', 'style': '{'},
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
        'file': {
            'level': 'INFO',
            'class': 'logging.FileHandler',
            'filename': BASE_DIR / 'friendly_banks.log',
            'formatter': 'verbose',
        },
    },
    'loggers': {
        'django': {'handlers': ['console', 'file'], 'level': 'INFO', 'propagate': False},
        'api': {'handlers': ['console', 'file'], 'level': 'INFO', 'propagate': False},
    },
}