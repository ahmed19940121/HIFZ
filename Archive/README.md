# Archive

Rollback copies. Nothing in this folder is served — `index.html` in the repo root is the live app.

| File | What it is |
|---|---|
| `index-v2.03-pre-seamless.html` | **The version immediately before the seamless-playback update.** If you don't like the new build, copy this over the root `index.html` and you are back exactly where you were. |
| `Old version`, `Old version 1.25`, `Old version 2`, `Old version 2.03` | Earlier iterations, oldest first. |
| `Backup`, `Backup2`, `Backup 3`, `Backup4` | Ad-hoc snapshots taken along the way. |
| `sw (misnamed, never registered).js` | The old service worker. It was saved as `sw .js` — with a space — while `index.html` registered `sw.js`, so the browser 404'd it and the PWA never actually cached anything offline. Replaced by a correctly named `sw.js` in the repo root. |

## Rolling back

```bash
cp "Archive/index-v2.03-pre-seamless.html" index.html
```

That restores the previous app in full. The new `sw.js` is harmless to leave in place, but if you want a completely clean revert, also delete `sw.js` from the root — the old build never loaded it anyway.
