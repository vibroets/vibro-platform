"""
Django Settings Configuration for Performance Optimization

Add these settings to your vibro/settings.py file to enable profiling and monitoring.
"""

# ============================================
# DEBUG TOOLBAR (Development Only)
# ============================================

# Install: pip install django-debug-toolbar

INSTALLED_APPS = [
    # ... your existing apps ...
    'debug_toolbar',  # Add this
]

MIDDLEWARE = [
    'debug_toolbar.middleware.DebugToolbarMiddleware',  # Add near the top
    # ... your existing middleware ...
]

# Configure Debug Toolbar
INTERNAL_IPS = [
    '127.0.0.1',
    'localhost',
]

# Debug Toolbar Panels (optional customization)
DEBUG_TOOLBAR_PANELS = [
    'debug_toolbar.panels.history.HistoryPanel',
    'debug_toolbar.panels.versions.VersionsPanel',
    'debug_toolbar.panels.timer.TimerPanel',
    'debug_toolbar.panels.settings.SettingsPanel',
    'debug_toolbar.panels.headers.HeadersPanel',
    'debug_toolbar.panels.request.RequestPanel',
    'debug_toolbar.panels.sql.SQLPanel',  # Most important for query optimization
    'debug_toolbar.panels.staticfiles.StaticFilesPanel',
    'debug_toolbar.panels.templates.TemplatesPanel',
    'debug_toolbar.panels.cache.CachePanel',
    'debug_toolbar.panels.signals.SignalsPanel',
    'debug_toolbar.panels.logging.LoggingPanel',
    'debug_toolbar.panels.redirects.RedirectsPanel',
    'debug_toolbar.panels.profiling.ProfilingPanel',
]

# Debug Toolbar Configuration
DEBUG_TOOLBAR_CONFIG = {
    'SHOW_TOOLBAR_CALLBACK': lambda request: DEBUG,  # Only show when DEBUG=True
    'SQL_WARNING_THRESHOLD': 10,  # Warn when query takes more than 10ms
}


# ============================================
# QUERY PROFILING MIDDLEWARE
# ============================================

MIDDLEWARE += [
    # Choose ONE of the following based on your needs:
    
    # Option 1: Basic query counting (recommended for development)
    'vibro.query_profiling_middleware.QueryCountDebugMiddleware',
    
    # Option 2: Detailed query logging (use temporarily for debugging specific endpoints)
    # 'vibro.query_profiling_middleware.DetailedQueryLogMiddleware',
    
    # Option 3: Performance stats in headers (safe for production)
    # 'vibro.query_profiling_middleware.PerformanceStatsMiddleware',
]

# Query profiling settings
QUERY_COUNT_WARNING_THRESHOLD = 10  # Warn if queries exceed this number
LOG_SLOW_QUERIES = True  # Log individual slow queries
SLOW_QUERY_THRESHOLD = 0.1  # Queries slower than 100ms


# ============================================
# DJANGO SILK (Advanced Profiling - Optional)
# ============================================

# Install: pip install django-silk

# INSTALLED_APPS += ['silk']
# MIDDLEWARE += ['silk.middleware.SilkyMiddleware']

# Silk Configuration
# SILKY_PYTHON_PROFILER = True
# SILKY_PYTHON_PROFILER_BINARY = True
# SILKY_MAX_REQUEST_BODY_SIZE = 1024 * 1024  # 1MB
# SILKY_MAX_RESPONSE_BODY_SIZE = 1024 * 1024  # 1MB


# ============================================
# LOGGING CONFIGURATION
# ============================================

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
        'simple': {
            'format': '{levelname} {message}',
            'style': '{',
        },
        'detailed': {
            'format': '[{asctime}] {levelname} {name} - {message}',
            'style': '{',
            'datefmt': '%Y-%m-%d %H:%M:%S',
        },
    },
    'filters': {
        'require_debug_true': {
            '()': 'django.utils.log.RequireDebugTrue',
        },
        'require_debug_false': {
            '()': 'django.utils.log.RequireDebugFalse',
        },
    },
    'handlers': {
        'console': {
            'level': 'INFO',
            'class': 'logging.StreamHandler',
            'formatter': 'simple',
        },
        'console_verbose': {
            'level': 'DEBUG',
            'filters': ['require_debug_true'],
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
        'query_performance_file': {
            'level': 'INFO',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': 'query_performance.log',
            'maxBytes': 1024 * 1024 * 10,  # 10MB
            'backupCount': 5,
            'formatter': 'detailed',
        },
        'error_file': {
            'level': 'ERROR',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': 'errors.log',
            'maxBytes': 1024 * 1024 * 10,  # 10MB
            'backupCount': 5,
            'formatter': 'verbose',
        },
    },
    'loggers': {
        # Django's built-in loggers
        'django': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': True,
        },
        'django.request': {
            'handlers': ['error_file'],
            'level': 'ERROR',
            'propagate': False,
        },
        # Database query logging (useful for development)
        'django.db.backends': {
            'handlers': ['console_verbose'],
            'level': 'DEBUG',
            'filters': ['require_debug_true'],
            'propagate': False,
        },
        # Your app loggers
        'user': {
            'handlers': ['console', 'error_file'],
            'level': 'INFO',
            'propagate': False,
        },
        'form': {
            'handlers': ['console', 'error_file'],
            'level': 'INFO',
            'propagate': False,
        },
        # Query profiling middleware logger
        'vibro.query_profiling_middleware': {
            'handlers': ['console', 'query_performance_file'],
            'level': 'INFO',
            'propagate': False,
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
}


# ============================================
# DATABASE OPTIMIZATION SETTINGS
# ============================================

# Database connection pooling (if using PostgreSQL)
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'your_db_name',
        'USER': 'your_db_user',
        'PASSWORD': 'your_db_password',
        'HOST': 'localhost',
        'PORT': '5432',
        # Connection pooling
        'CONN_MAX_AGE': 600,  # Keep connections alive for 10 minutes
        'OPTIONS': {
            'connect_timeout': 10,
        },
    }
}

# Enable persistent database connections
CONN_MAX_AGE = 600  # 10 minutes


# ============================================
# REST FRAMEWORK CONFIGURATION
# ============================================

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    # Default pagination (applied to all list views)
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 50,  # Default page size
    
    # Performance optimizations
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
    
    # Throttling (rate limiting)
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '100/hour',
        'user': '1000/hour',
    },
}


# ============================================
# CACHING (Optional - Future Enhancement)
# ============================================

# Using Redis for caching
# CACHES = {
#     'default': {
#         'BACKEND': 'django_redis.cache.RedisCache',
#         'LOCATION': 'redis://127.0.0.1:6379/1',
#         'OPTIONS': {
#             'CLIENT_CLASS': 'django_redis.client.DefaultClient',
#         },
#         'KEY_PREFIX': 'vibro',
#         'TIMEOUT': 300,  # 5 minutes default timeout
#     }
# }

# Cache middleware (add to MIDDLEWARE)
# MIDDLEWARE = [
#     'django.middleware.cache.UpdateCacheMiddleware',  # Top
#     # ... other middleware ...
#     'django.middleware.cache.FetchFromCacheMiddleware',  # Bottom
# ]

# CACHE_MIDDLEWARE_ALIAS = 'default'
# CACHE_MIDDLEWARE_SECONDS = 600
# CACHE_MIDDLEWARE_KEY_PREFIX = 'vibro'


# ============================================
# PRODUCTION SETTINGS (when deploying)
# ============================================

if not DEBUG:
    # Disable query debugging in production
    LOGGING['loggers']['django.db.backends']['level'] = 'INFO'
    
    # Remove debug toolbar
    if 'debug_toolbar' in INSTALLED_APPS:
        INSTALLED_APPS.remove('debug_toolbar')
    
    # Use production-safe middleware
    MIDDLEWARE = [m for m in MIDDLEWARE if 'DebugToolbar' not in m]
    MIDDLEWARE = [m for m in MIDDLEWARE if 'DetailedQueryLog' not in m]
    
    # Keep only PerformanceStatsMiddleware for monitoring
    if 'vibro.query_profiling_middleware.QueryCountDebugMiddleware' in MIDDLEWARE:
        MIDDLEWARE.remove('vibro.query_profiling_middleware.QueryCountDebugMiddleware')
    if 'vibro.query_profiling_middleware.PerformanceStatsMiddleware' not in MIDDLEWARE:
        MIDDLEWARE.append('vibro.query_profiling_middleware.PerformanceStatsMiddleware')


# ============================================
# MONITORING & APM (Production)
# ============================================

# Sentry for error tracking
# import sentry_sdk
# from sentry_sdk.integrations.django import DjangoIntegration

# sentry_sdk.init(
#     dsn="your-sentry-dsn",
#     integrations=[DjangoIntegration()],
#     traces_sample_rate=0.1,  # 10% of transactions
#     send_default_pii=True,
# )

# New Relic APM
# NEW_RELIC_CONFIG_FILE = '/path/to/newrelic.ini'
# NEW_RELIC_ENVIRONMENT = 'production'


# ============================================
# CUSTOM SETTINGS FOR PERFORMANCE
# ============================================

# Email batch size for bulk operations
EMAIL_BATCH_SIZE = 100

# Bulk import batch size
BULK_IMPORT_BATCH_SIZE = 500

# Maximum records per page
MAX_PAGE_SIZE = 200

# Query timeout (seconds)
DATABASE_QUERY_TIMEOUT = 30


# ============================================
# USAGE EXAMPLES
# ============================================

"""
1. DEVELOPMENT:
   - Set DEBUG = True
   - Use QueryCountDebugMiddleware
   - Enable Django Debug Toolbar
   - Check query_performance.log

2. STAGING:
   - Set DEBUG = False
   - Use PerformanceStatsMiddleware
   - Monitor response headers
   - Check error logs

3. PRODUCTION:
   - Set DEBUG = False
   - Use PerformanceStatsMiddleware only
   - Enable APM (Sentry/New Relic)
   - Monitor slow query logs in PostgreSQL
   
4. TESTING QUERIES:
   python manage.py shell
   >>> from django.db import connection
   >>> from user.models import CustomUser
   >>> from django.db import reset_queries
   >>> reset_queries()
   >>> users = CustomUser.objects.select_related('role', 'organization').all()[:10]
   >>> list(users)
   >>> print(f"Queries: {len(connection.queries)}")
   >>> for q in connection.queries:
   ...     print(q['sql'])
"""


