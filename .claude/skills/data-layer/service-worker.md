# Service Worker & Connectivity

Service worker lifecycle, cache strategies, and connectivity detection for the Coop PWA (app package).

---

## Service Worker Lifecycle

### Cache Strategies

Coop uses different strategies per resource type:

| Resource | Strategy | Why |
|----------|----------|-----|
| App shell (HTML) | Network-first, cache fallback | Always serve latest, work offline |
| Static assets (`/assets/*`) | Cache-first (immutable) | Hashed filenames, never changes |
| API calls | Network-only + cache fallback | Fresh data preferred, stale OK offline |
| Service worker (`/sw.js`) | Network-only | Must always check for updates |

### Controller Change Handling

```typescript
// Handle service worker updates (new version available)
navigator.serviceWorker.addEventListener(
  "controllerchange",
  () => window.location.reload(),
  { once: true }
);
```

---

## Connectivity Detection

```typescript
function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return isOnline;
}
```

### Offline Banner

```typescript
function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (!isOnline) {
    return (
      <div role="status" className="bg-warning text-warning-foreground p-2 text-center">
        You're offline. Changes are saved locally and will sync when you reconnect.
      </div>
    );
  }

  return null;
}
```
