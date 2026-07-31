-- Verify Database Indexes for Optimized Endpoints
-- Run this in PostgreSQL: python manage.py dbshell

-- 1. List all indexes on user_customuser table
\d user_customuser

-- 2. List all custom indexes we created
\di user_*
\di org_*
\di group_*

-- 3. Check if indexes are being used (after some queries)
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as times_used,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
  AND (indexname LIKE 'user_%' OR indexname LIKE 'org_%' OR indexname LIKE 'group_%')
ORDER BY idx_scan DESC;

-- 4. Explain query plans for our optimized endpoints

-- Test 1: Users list endpoint
EXPLAIN ANALYZE
SELECT * FROM user_customuser 
WHERE is_deleted = FALSE 
  AND is_archived = FALSE 
LIMIT 50;

-- Test 2: Users by organization endpoint
EXPLAIN ANALYZE
SELECT * FROM user_customuser 
WHERE organization_id = 25
  AND is_deleted = FALSE 
  AND is_archived = FALSE;

-- Test 3: Groups endpoint
EXPLAIN ANALYZE
SELECT * FROM user_groups 
WHERE is_deleted = FALSE 
  AND is_archived = FALSE;

-- Test 4: Groups by organization
EXPLAIN ANALYZE
SELECT * FROM user_groups 
WHERE organization_id = 25
  AND is_deleted = FALSE 
  AND is_archived = FALSE;

-- 5. Check for missing indexes (finds slow queries without index usage)
SELECT 
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
FROM pg_stats
WHERE schemaname = 'public'
  AND tablename IN ('user_customuser', 'user_groups', 'user_organization')
  AND n_distinct > 100  -- High cardinality columns
ORDER BY tablename, attname;



