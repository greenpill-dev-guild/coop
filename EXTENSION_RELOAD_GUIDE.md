# Extension Reload Guide

## Issue Fixed

Fixed TypeScript type error in `packages/extension/src/views/Sidepanel/SidepanelTabRouter.tsx`:
- Changed `Extract<SidepanelIntentSegment, 'signals' | 'drafts' | 'stale'>` to `SidepanelIntentSegment`
- The type definition was `'review' | 'shared' | 'summary' | 'agent'` but the code was expecting old type names

Extension has been rebuilt successfully.

## Steps to Reload in Chrome

1. **Open Chrome Extensions Page**
   - Go to `chrome://extensions/`
   - OR: Click Menu (⋮) → More tools → Extensions

2. **Reload Coop Extension**
   - Find "Coop v1" in the list
   - Click the **reload button** (circular arrow icon) on the card

3. **Verify it Loads**
   - Extension icon should appear in toolbar (not white square)
   - Click icon to open popup - should show normally
   - Check DevTools (F12) in the popup for any errors
   - Should be clean now

## If Still Getting Errors

If you still see "Unexpected end of input":

1. **Remove and reload from scratch**
   ```
   - Remove "Coop v1" extension (click trash icon)
   - Go to chrome://extensions
   - Enable "Developer mode" (top right)
   - Click "Load unpacked"
   - Navigate to: /Users/luizfernando/Desktop/Workspaces/Zettelkasten/03\ Libraries/coop/packages/extension/dist/chrome-mv3/
   - Select folder
   ```

2. **Check for console errors**
   - Open DevTools in popup (F12)
   - Check Console tab for any red errors
   - Screenshot and share if errors persist

3. **Verify dev servers**
   - App should be running: http://127.0.0.1:3001 (check it loads)
   - API should be running: curl http://127.0.0.1:4444/health (should return {"status":"ok"})
   - Extension dev server on 3020: check popup loads from dev server

## Testing After Reload

Once extension loads successfully:

1. Open a few tabs in Chrome
2. Click Coop extension icon
3. Try "Capture Tab" button
4. Should see captured tabs in popup

Let me know if you hit any issues!
