"""
Django settings for chater project.
"""

import os
from datetime import timedelta
from pathlib import Path
from django.core.exceptions import ImproperlyConfigured

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent


def env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.lower() in {"1", "true", "yes", "on"}


def env_list(name: str, default: str = "") -> list[str]:
    raw = os.getenv(name, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


def env_required(name: str) -> str:
    value = os.getenv(name)
    if value is None or not value.strip():
        raise ImproperlyConfigured(f"Missing required environment variable: {name}")
    return value


# Quick-start defaults for local development.
# Production should always override via environment variables.

SECRET_KEY = env_required("DJANGO_SECRET_KEY")

DEBUG = env_bool("DJANGO_DEBUG", True)
ENABLE_CORS = env_bool("ENABLE_CORS", DEBUG)

ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS")
if not ALLOWED_HOSTS:
    raise ImproperlyConfigured("DJANGO_ALLOWED_HOSTS must not be empty")


# Application definition

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'accounts', 
    'chat',
    'channels',
]
if ENABLE_CORS:
    INSTALLED_APPS.append("corsheaders")

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]
if ENABLE_CORS:
    MIDDLEWARE.insert(0, "corsheaders.middleware.CorsMiddleware")

ROOT_URLCONF = 'chater.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'chater.wsgi.application'
ASGI_APPLICATION = "chater.asgi.application"


DATABASES = {
    'default': {
        'ENGINE': env_required('DB_ENGINE'),
        'NAME': env_required('DB_NAME'),
        'USER': env_required('DB_USER'),
        'PASSWORD': os.getenv('DB_PASSWORD', ''),
        'HOST': env_required('DB_HOST'),
        'PORT': env_required('DB_PORT'),
    }
}


# Password validation
# https://docs.djangoproject.com/en/5.0/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Internationalization
# https://docs.djangoproject.com/en/5.0/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_TZ = True


STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / "staticfiles"

# Default primary key field type
# https://docs.djangoproject.com/en/5.0/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "accounts.auth.CookieJWTAuthentication",
    ],
}


CSRF_TRUSTED_ORIGINS = env_list(
    "CSRF_TRUSTED_ORIGINS",
    "",
)

# Keep cookie settings environment-driven for local/prod parity.
CSRF_COOKIE_SECURE = env_bool("CSRF_COOKIE_SECURE", False)
CSRF_COOKIE_SAMESITE = os.getenv("CSRF_COOKIE_SAMESITE", "Lax")
SESSION_COOKIE_SECURE = env_bool("SESSION_COOKIE_SECURE", False)
SESSION_COOKIE_SAMESITE = os.getenv("SESSION_COOKIE_SAMESITE", "Lax")

if ENABLE_CORS:
    CORS_ALLOW_ALL_ORIGINS = env_bool("CORS_ALLOW_ALL_ORIGINS", False)
    CORS_ALLOWED_ORIGINS = env_list(
        "CORS_ALLOWED_ORIGINS",
        "",
    )
    CORS_ALLOW_CREDENTIALS = env_bool("CORS_ALLOW_CREDENTIALS", True)

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(
        minutes=int(os.getenv("JWT_ACCESS_MINUTES", "60"))
    ),
    "REFRESH_TOKEN_LIFETIME": timedelta(
        days=int(os.getenv("JWT_REFRESH_DAYS", "1"))
    ),

    "ROTATE_REFRESH_TOKENS": False,
    "BLACKLIST_AFTER_ROTATION": False,

    "ALGORITHM": "HS256",
    "SIGNING_KEY": SECRET_KEY,

    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",

    # Cookie-based JWT
    "AUTH_COOKIE": "access_token",
    "AUTH_COOKIE_REFRESH": "refresh_token",

    "AUTH_COOKIE_SECURE": env_bool("JWT_COOKIE_SECURE", False),
    "AUTH_COOKIE_SAMESITE": os.getenv("JWT_COOKIE_SAMESITE", "Lax"),
}


CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [env_required("REDIS_URL")],
        },
    },
}


# Security headers for production reverse-proxy setup.
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_HSTS_SECONDS = int(os.getenv("SECURE_HSTS_SECONDS", "31536000"))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_SSL_REDIRECT = env_bool("SECURE_SSL_REDIRECT", True)
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = "DENY"
