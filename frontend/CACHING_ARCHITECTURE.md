# Frontend Caching Architecture

## Overview

The frontend uses a **two-layer caching system** to optimize API requests:

1. **`withCaching.js`** - Global fetch wrapper (automatic caching for all fetch calls)
2. **`apiOptimizer.js`** - Specialized caching for API service calls

## Purpose of Each Layer

### 1. `withCaching.js` (Global Auto-Cache)

**Purpose:**
- Wraps `window.fetch` globally to automatically cache ALL GET requests
- Provides automatic caching for any fetch call in the application
- Useful for third-party libraries or direct fetch calls that don't use `apiService`

**Features:**
- Automatic request deduplication
- Performance tracking
- 2-minute default cache TTL
- Uses `sessionStorage` via `cacheUtils.js`

**When it's used:**
- Direct `fetch()` calls
- Third-party library requests
- Non-API service requests

**Cache Key Format:**
```
auto_${url}
```

### 2. `apiOptimizer.js` (API Service Cache)

**Purpose:**
- Specialized caching for `apiService` calls
- Handles MVC response format
- More control over cache keys and TTL
- Used by `apiService.getTheaters()`, `apiService.getRoles()`, etc.

**Features:**
- Request deduplication
- Custom cache keys
- Custom TTL per request
- MVC response handling
- Uses `sessionStorage` via `cacheUtils.js`

**When it's used:**
- All `apiService` method calls
- MVC API endpoints (`/api/theaters`, `/api/roles`, etc.)

**Cache Key Format:**
```
api_${endpoint} or custom key
```

## The Problem (Before Fix)

**Double Caching Conflict:**
- `apiService.getTheaters()` → calls `optimizedFetch()` → calls `fetch()`
- `withCaching.js` intercepts the `fetch()` call → caches again
- Result: Same request cached twice with different keys
- Result: Unnecessary deduplication logs

## The Solution

**Skip Flag System:**
- `apiService` adds `_skipAutoCache: true` and `X-Skip-Auto-Cache: 'true'` to requests
- `withCaching.js` checks for these flags and skips auto-caching
- `optimizedFetch` also adds these flags when calling `fetch()`

**Result:**
- API service requests use only `optimizedFetch` caching
- Other fetch calls use `withCaching.js` auto-cache
- No double caching
- Cleaner logs

## Cache Storage

Both systems use **`cacheUtils.js`** which stores data in:
- **Storage:** `sessionStorage` (cleared when browser tab closes)
- **Format:** `{ data: {...}, timestamp: 1234567890 }`
- **TTL:** Configurable per request (default: 2 minutes)

## Cache Keys

### withCaching.js
```
auto_http://localhost:8080/api/theaters?page=1&limit=10
```

### apiOptimizer.js
```
api_/theaters
or
fetch_http://localhost:8080/api/theaters?page=1&limit=10
```

## Best Practices

1. **Use `apiService` for all MVC API calls** - Gets optimized caching
2. **Direct `fetch()` calls** - Will use `withCaching.js` auto-cache
3. **Custom cache keys** - Use when you need specific cache control
4. **TTL Configuration** - Adjust based on data freshness requirements

## Debugging

### Check Cache Status
```javascript
// In browser console
window.showCacheStats() // Shows withCaching.js stats
```

### Clear Cache
```javascript
// Clear all sessionStorage cache
sessionStorage.clear()
```

### Check Specific Cache
```javascript
// Check if data is cached
const cached = sessionStorage.getItem('api_/theaters')
console.log(JSON.parse(cached))
```

## Performance Impact

- **Cache Hit:** < 1ms (instant)
- **Cache Miss:** Network request time (varies)
- **Deduplication:** Prevents duplicate simultaneous requests
- **Memory:** Uses sessionStorage (limited to ~5-10MB per domain)

## Summary

- **`withCaching.js`**: Global auto-cache for all fetch calls
- **`apiOptimizer.js`**: Specialized cache for API service
- **Conflict Resolution**: Skip flags prevent double caching
- **Storage**: Both use `sessionStorage` via `cacheUtils.js`
- **Result**: Optimized performance with no conflicts

