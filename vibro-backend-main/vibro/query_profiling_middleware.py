"""
Query Profiling Middleware for Django REST API
This middleware tracks and logs database query performance
"""

import time
import logging
from django.db import connection, reset_queries
from django.conf import settings
from django.utils.deprecation import MiddlewareMixin

logger = logging.getLogger(__name__)


class QueryCountDebugMiddleware(MiddlewareMixin):
    """
    Middleware to count and log database queries for each request.
    
    Features:
    - Logs total query count
    - Logs total query time
    - Warns on high query count (>10 queries)
    - Can be configured to log individual slow queries
    
    Usage:
        Add to MIDDLEWARE in settings.py:
        MIDDLEWARE = [
            ...
            'vibro.query_profiling_middleware.QueryCountDebugMiddleware',
        ]
    
    Configuration in settings.py:
        QUERY_COUNT_WARNING_THRESHOLD = 10  # Warn if queries exceed this
        LOG_SLOW_QUERIES = True  # Log queries taking > 100ms
        SLOW_QUERY_THRESHOLD = 0.1  # seconds
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
        self.warning_threshold = getattr(settings, 'QUERY_COUNT_WARNING_THRESHOLD', 10)
        self.log_slow_queries = getattr(settings, 'LOG_SLOW_QUERIES', False)
        self.slow_query_threshold = getattr(settings, 'SLOW_QUERY_THRESHOLD', 0.1)

    def __call__(self, request):
        # Reset query log before processing request
        reset_queries()
        
        # Start timer
        start_time = time.time()
        
        # Process request
        response = self.get_response(request)
        
        # Calculate duration
        duration = time.time() - start_time
        
        # Only log if DEBUG is True (to avoid performance impact in production)
        if settings.DEBUG:
            self._log_queries(request, duration)
        
        # Add query count to response headers (useful for frontend debugging)
        response['X-DB-Query-Count'] = str(len(connection.queries))
        response['X-Request-Duration'] = f"{duration:.3f}s"
        
        return response

    def _log_queries(self, request, duration):
        """Log query statistics"""
        query_count = len(connection.queries)
        total_query_time = sum(float(q['time']) for q in connection.queries)
        
        # Build log message
        log_message = (
            f"\n{'='*80}\n"
            f"🔍 Query Performance Report\n"
            f"{'='*80}\n"
            f"📍 Endpoint: {request.method} {request.path}\n"
            f"🔢 Total Queries: {query_count}\n"
            f"⏱️  Total Query Time: {total_query_time:.3f}s\n"
            f"⏱️  Total Request Time: {duration:.3f}s\n"
            f"📊 Query Time %: {(total_query_time/duration*100):.1f}%\n"
        )
        
        # Add warning if query count is high
        if query_count > self.warning_threshold:
            log_message += f"⚠️  WARNING: High query count ({query_count} > {self.warning_threshold})\n"
        
        # Log slow queries if enabled
        if self.log_slow_queries:
            slow_queries = [q for q in connection.queries if float(q['time']) > self.slow_query_threshold]
            if slow_queries:
                log_message += f"\n🐌 Slow Queries ({len(slow_queries)} queries > {self.slow_query_threshold}s):\n"
                for i, query in enumerate(slow_queries, 1):
                    log_message += f"\n  Query {i} ({query['time']}s):\n"
                    log_message += f"  {query['sql'][:200]}...\n"
        
        log_message += f"{'='*80}\n"
        
        # Log based on severity
        if query_count > self.warning_threshold:
            logger.warning(log_message)
        else:
            logger.info(log_message)


class DetailedQueryLogMiddleware(MiddlewareMixin):
    """
    More detailed query logging middleware that logs ALL queries.
    
    ⚠️ WARNING: This will generate A LOT of logs. 
    Only use during development/debugging specific endpoints.
    
    Usage:
        Add to MIDDLEWARE in settings.py (temporarily):
        MIDDLEWARE = [
            ...
            'vibro.query_profiling_middleware.DetailedQueryLogMiddleware',
        ]
    """
    
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        reset_queries()
        
        print(f"\n{'='*100}")
        print(f"🚀 REQUEST: {request.method} {request.path}")
        print(f"{'='*100}\n")
        
        response = self.get_response(request)
        
        print(f"\n{'='*100}")
        print(f"📊 QUERY LOG FOR: {request.method} {request.path}")
        print(f"{'='*100}")
        print(f"Total Queries: {len(connection.queries)}\n")
        
        for i, query in enumerate(connection.queries, 1):
            print(f"\n--- Query {i} ({query['time']}s) ---")
            print(query['sql'])
        
        print(f"\n{'='*100}\n")
        
        return response


class PerformanceStatsMiddleware(MiddlewareMixin):
    """
    Lightweight middleware that adds performance stats to response headers.
    Safe to use in production.
    
    Response headers added:
    - X-DB-Query-Count: Number of database queries
    - X-DB-Query-Time: Total time spent in database queries
    - X-Request-Time: Total request processing time
    - X-Python-Time: Time spent in Python (Request Time - Query Time)
    
    Usage:
        Add to MIDDLEWARE in settings.py:
        MIDDLEWARE = [
            ...
            'vibro.query_profiling_middleware.PerformanceStatsMiddleware',
        ]
    """
    
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        reset_queries()
        start_time = time.time()
        
        response = self.get_response(request)
        
        duration = time.time() - start_time
        query_count = len(connection.queries)
        query_time = sum(float(q['time']) for q in connection.queries)
        python_time = duration - query_time
        
        # Add performance headers
        response['X-DB-Query-Count'] = str(query_count)
        response['X-DB-Query-Time'] = f"{query_time:.3f}"
        response['X-Request-Time'] = f"{duration:.3f}"
        response['X-Python-Time'] = f"{python_time:.3f}"
        
        # Log warnings for slow endpoints
        if duration > 1.0:  # More than 1 second
            logger.warning(
                f"Slow endpoint: {request.method} {request.path} "
                f"took {duration:.3f}s ({query_count} queries, {query_time:.3f}s in DB)"
            )
        
        return response


# ============================================
# QUERY ANALYZER UTILITY
# ============================================

class QueryAnalyzer:
    """
    Utility class for analyzing query patterns in specific views.
    
    Usage:
        from vibro.query_profiling_middleware import QueryAnalyzer
        
        def my_view(request):
            with QueryAnalyzer("MyView"):
                # Your view logic here
                users = CustomUser.objects.all()
                return Response(...)
    """
    
    def __init__(self, name):
        self.name = name
        self.query_count_before = 0
    
    def __enter__(self):
        reset_queries()
        self.query_count_before = len(connection.queries)
        print(f"\n🔍 Starting query analysis for: {self.name}")
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        new_queries = len(connection.queries) - self.query_count_before
        total_time = sum(float(q['time']) for q in connection.queries[self.query_count_before:])
        
        print(f"\n📊 Query Analysis Results for: {self.name}")
        print(f"  Queries executed: {new_queries}")
        print(f"  Total time: {total_time:.3f}s")
        
        if new_queries > 10:
            print(f"  ⚠️  WARNING: High query count!")
            print(f"\n  Queries executed:")
            for i, query in enumerate(connection.queries[self.query_count_before:], 1):
                print(f"\n  Query {i} ({query['time']}s):")
                print(f"  {query['sql'][:150]}...")


# ============================================
# VIEW DECORATOR FOR QUERY PROFILING
# ============================================

def profile_queries(func):
    """
    Decorator to profile queries for a specific view.
    
    Usage:
        from vibro.query_profiling_middleware import profile_queries
        
        @profile_queries
        def my_view(request):
            # Your view logic
            return Response(...)
    """
    from functools import wraps
    
    @wraps(func)
    def wrapper(*args, **kwargs):
        reset_queries()
        start_time = time.time()
        
        result = func(*args, **kwargs)
        
        duration = time.time() - start_time
        query_count = len(connection.queries)
        query_time = sum(float(q['time']) for q in connection.queries)
        
        logger.info(
            f"View {func.__name__}: "
            f"{query_count} queries in {query_time:.3f}s "
            f"(total: {duration:.3f}s)"
        )
        
        if query_count > 10:
            logger.warning(f"High query count in {func.__name__}: {query_count} queries")
        
        return result
    
    return wrapper


# ============================================
# CONFIGURATION EXAMPLE
# ============================================

"""
Add to settings.py:

# Query profiling settings
QUERY_COUNT_WARNING_THRESHOLD = 10
LOG_SLOW_QUERIES = True
SLOW_QUERY_THRESHOLD = 0.1  # 100ms

# Add middleware (choose one or more)
MIDDLEWARE = [
    ...
    'vibro.query_profiling_middleware.QueryCountDebugMiddleware',  # Basic stats
    # 'vibro.query_profiling_middleware.DetailedQueryLogMiddleware',  # Detailed (dev only)
    # 'vibro.query_profiling_middleware.PerformanceStatsMiddleware',  # Headers only (prod safe)
]

# Logging configuration
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
        'file': {
            'class': 'logging.FileHandler',
            'filename': 'query_performance.log',
            'formatter': 'verbose',
        },
    },
    'loggers': {
        'vibro.query_profiling_middleware': {
            'handlers': ['console', 'file'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}
"""


