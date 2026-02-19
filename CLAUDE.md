# LivePoll

Real-time interactive polling app — Mentimeter-style live polls with Firebase sync.

## Project Structure

```
livepoll/
├── index.html          # SPA shell (all screens)
├── css/style.css       # Styles (DM Sans + DM Serif Text)
├── js/
│   ├── config.js       # Firebase config
│   ├── sync.js         # Firebase real-time wrapper
│   ├── poll.js         # Poll data management
│   ├── charts.js       # Animated bar chart renderer
│   └── app.js          # Main app controller
├── tests/
│   └── test_livepoll.py  # Playwright E2E tests
└── .github/workflows/deploy.yml
```

## Custom Commands

### /start-app

Serve the static app locally:

```bash
python3 -m http.server 8080
# or
npx serve -l 8080
```

Then open http://localhost:8080

### /test-app

Run the full Playwright test suite:

```bash
# Install dependencies
pip install playwright
playwright install chromium

# Run with auto server
python3 .claude/test-app/scripts/with_server.py \
  --server "python3 -m http.server 8080" --port 8080 \
  -- python3 tests/test_livepoll.py

# Screenshots saved to screenshots/
```

### /firebase-setup

Set up Firebase Realtime Database:
1. Go to https://console.firebase.google.com
2. Create project → Add Web App → copy config to `js/config.js`
3. Enable Realtime Database → Start in test mode
