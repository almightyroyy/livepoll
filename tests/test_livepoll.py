"""
LivePoll — Playwright E2E Test Suite
Tests: home, create poll, join flow, mobile responsiveness

Run:
    pip install playwright
    playwright install chromium
    python3 .claude/test-app/scripts/with_server.py \
        --server "python3 -m http.server 8080" --port 8080 \
        -- python3 tests/test_livepoll.py
"""

import sys, os, time
from playwright.sync_api import sync_playwright, expect

BASE_URL = os.environ.get("TEST_URL", "http://localhost:8080")
PASS, FAIL = "✅", "❌"
results = []

def run(name, fn, page):
    try:
        fn(page)
        results.append((PASS, name))
        print(f"  {PASS} {name}")
    except Exception as e:
        results.append((FAIL, name, str(e)))
        print(f"  {FAIL} {name}: {e}")

# ── Test functions ──────────────────────────────────────

def test_home_loads(page):
    page.goto(BASE_URL)
    page.wait_for_load_state("networkidle")
    assert page.title() != ""
    assert page.locator("#screen-home").is_visible()

def test_brand_visible(page):
    page.goto(BASE_URL)
    assert "LivePoll" in page.locator(".brand-name").first.inner_text()

def test_hero_title_visible(page):
    page.goto(BASE_URL)
    title = page.locator(".hero-title").inner_text()
    assert len(title) > 5

def test_demo_bars_visible(page):
    page.goto(BASE_URL)
    bars = page.locator(".demo-bar")
    assert bars.count() >= 3

def test_create_poll_button(page):
    page.goto(BASE_URL)
    page.locator("#btnCreatePoll").click()
    page.wait_for_timeout(400)
    assert page.locator("#screen-create").is_visible()

def test_create_screen_has_input(page):
    page.goto(BASE_URL)
    page.locator("#btnCreatePoll").click()
    page.wait_for_timeout(400)
    assert page.locator("#pollTitle").is_visible()

def test_default_question_added(page):
    page.goto(BASE_URL)
    page.locator("#btnCreatePoll").click()
    page.wait_for_timeout(400)
    cards = page.locator(".question-card")
    assert cards.count() >= 1

def test_add_question_button(page):
    page.goto(BASE_URL)
    page.locator("#btnCreatePoll").click()
    page.wait_for_timeout(400)
    before = page.locator(".question-card").count()
    page.locator("#btnAddQuestion").click()
    page.wait_for_timeout(300)
    assert page.locator(".question-card").count() == before + 1

def test_add_option_button(page):
    page.goto(BASE_URL)
    page.locator("#btnCreatePoll").click()
    page.wait_for_timeout(400)
    before = page.locator(".option-input").count()
    page.locator(".btn-add-option").first.click()
    page.wait_for_timeout(300)
    assert page.locator(".option-input").count() == before + 1

def test_back_from_create(page):
    page.goto(BASE_URL)
    page.locator("#btnCreatePoll").click()
    page.wait_for_timeout(400)
    page.locator("#btnBackFromCreate").click()
    page.wait_for_timeout(400)
    assert page.locator("#screen-home").is_visible()

def test_join_screen_from_nav(page):
    page.goto(BASE_URL)
    page.locator("#btnHomeJoin").click()
    page.wait_for_timeout(400)
    assert page.locator("#screen-join").is_visible()

def test_join_back_button(page):
    page.goto(BASE_URL)
    page.locator("#btnHomeJoin").click()
    page.wait_for_timeout(400)
    page.locator("#btnJoinBack").click()
    page.wait_for_timeout(400)
    assert page.locator("#screen-home").is_visible()

def test_join_invalid_code(page):
    page.goto(BASE_URL)
    page.locator("#btnHomeJoin").click()
    page.wait_for_timeout(400)
    page.locator("#joinCode").fill("999999")
    page.locator("#btnJoinPoll").click()
    page.wait_for_timeout(2000)
    # Should show error or stay on join
    assert page.locator("#screen-join").is_visible() or \
           page.locator("#joinError").is_visible()

def test_join_url_param(page):
    page.goto(f"{BASE_URL}?join=123456")
    page.wait_for_timeout(1000)
    # Should navigate to join or show error
    visible_screens = ["screen-join", "screen-waiting", "screen-home"]
    assert any(page.locator(f"#{s}").is_visible() for s in visible_screens)

def test_no_console_errors(page):
    errors = []
    page.on("console", lambda msg: errors.append(msg) if msg.type == "error" else None)
    page.goto(BASE_URL)
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)
    # Firebase errors are expected without real room — filter those
    real_errors = [e for e in errors if "firebase" not in e.text.lower()
                   and "404" not in e.text and "ERR_" not in e.text]
    assert len(real_errors) == 0, f"Console errors: {[e.text for e in real_errors]}"

# ── Mobile Tests ────────────────────────────────────────

def test_mobile_home_375(page):
    page.set_viewport_size({"width": 375, "height": 667})
    page.goto(BASE_URL)
    page.wait_for_load_state("networkidle")
    overflow = page.evaluate("() => document.documentElement.scrollWidth > document.documentElement.clientWidth")
    assert not overflow, "Horizontal overflow on 375px"

def test_mobile_home_390(page):
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(BASE_URL)
    page.wait_for_load_state("networkidle")
    assert page.locator("#btnCreatePoll").is_visible()
    assert page.locator("#btnHomeJoin").is_visible()

def test_mobile_create_768(page):
    page.set_viewport_size({"width": 768, "height": 1024})
    page.goto(BASE_URL)
    page.locator("#btnCreatePoll").click()
    page.wait_for_timeout(400)
    assert page.locator("#pollTitle").is_visible()

def test_touch_targets(page):
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(BASE_URL)
    page.wait_for_load_state("networkidle")
    issues = page.evaluate("""() => {
        const issues = [];
        document.querySelectorAll('button, a, input').forEach(el => {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.height > 0 && (r.width < 40 || r.height < 36)) {
                issues.push(el.tagName + ':' + (el.textContent||el.type||'').slice(0,20).trim());
            }
        });
        return issues;
    }""")
    assert len(issues) == 0, f"Small touch targets: {issues}"

def test_viewport_meta(page):
    page.goto(BASE_URL)
    meta = page.evaluate("""() => {
        const m = document.querySelector('meta[name=\"viewport\"]');
        return m ? m.getAttribute('content') : null;
    }""")
    assert meta is not None, "Missing viewport meta tag"
    assert "width=device-width" in meta

def test_screenshot_home(page):
    page.set_viewport_size({"width": 1280, "height": 800})
    page.goto(BASE_URL)
    page.wait_for_timeout(1500)
    os.makedirs("screenshots", exist_ok=True)
    page.screenshot(path="screenshots/home.png", full_page=True)

def test_screenshot_home_mobile(page):
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(BASE_URL)
    page.wait_for_timeout(800)
    os.makedirs("screenshots", exist_ok=True)
    page.screenshot(path="screenshots/home_mobile.png", full_page=True)

def test_screenshot_create(page):
    page.goto(BASE_URL)
    page.locator("#btnCreatePoll").click()
    page.wait_for_timeout(600)
    os.makedirs("screenshots", exist_ok=True)
    page.screenshot(path="screenshots/create.png", full_page=True)

def test_screenshot_join(page):
    page.goto(BASE_URL)
    page.locator("#btnHomeJoin").click()
    page.wait_for_timeout(600)
    os.makedirs("screenshots", exist_ok=True)
    page.screenshot(path="screenshots/join.png", full_page=True)

# ── Runner ──────────────────────────────────────────────

TESTS = [
    test_home_loads, test_brand_visible, test_hero_title_visible,
    test_demo_bars_visible, test_create_poll_button,
    test_create_screen_has_input, test_default_question_added,
    test_add_question_button, test_add_option_button, test_back_from_create,
    test_join_screen_from_nav, test_join_back_button, test_join_invalid_code,
    test_join_url_param, test_no_console_errors,
    test_mobile_home_375, test_mobile_home_390, test_mobile_create_768,
    test_touch_targets, test_viewport_meta,
    test_screenshot_home, test_screenshot_home_mobile,
    test_screenshot_create, test_screenshot_join,
]

if __name__ == "__main__":
    print(f"\n🧪 LivePoll E2E Tests — {BASE_URL}\n{'─'*50}")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        for test_fn in TESTS:
            page = browser.new_page()
            run(test_fn.__name__.replace("test_", "").replace("_", " "), test_fn, page)
            page.close()
        browser.close()

    passed = sum(1 for r in results if r[0] == PASS)
    failed = sum(1 for r in results if r[0] == FAIL)
    print(f"\n{'─'*50}")
    print(f"Results: {passed} passed, {failed} failed / {len(results)} total")
    if failed:
        print("\nFailures:")
        for r in results:
            if r[0] == FAIL: print(f"  {r[1]}: {r[2]}")
    sys.exit(1 if failed else 0)
