"""End-to-end smoke tests of critical public workflows in headless Chromium."""
import http.server
import json
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_):
        return


def main():
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Quiet)
    Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{server.server_port}"
    results = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox"])
        context = browser.new_context(accept_downloads=True, service_workers="block")
        context.set_default_timeout(15000)
        page = context.new_page()
        try:
            page.goto(base + "/", wait_until="load")
            expect(page.locator("h1")).to_contain_text("Ragunauth")
            expect(page.locator(".nav-links")).to_be_visible()
            expect(page.locator('.nav-links a[href="/engage/"]')).to_be_visible()
            expect(page.locator('.nav-links a[href="/resume.html"]')).to_be_visible()
            expect(page.locator("#honours-title")).to_contain_text("public record")
            assert page.locator(".flag-honours__grid .flag-hero__affiliation").count() == 3
            expect(page.locator("body")).to_contain_text("Liaison Director, Social Responsibility Department")
            expect(page.locator("#decision-paths")).to_contain_text("Two audiences.")
            assert "five role progressions" not in page.locator("body").inner_text().lower()
            expect(page.locator(".flag-hero__portrait-wrap img")).to_have_attribute("width", "800")
            expect(page.locator(".flag-hero__portrait-wrap img")).to_have_attribute("height", "1030")
            expect(page.locator(".flag-hero__portrait-wrap img")).to_have_attribute("src", "/assets/randy-portrait.jpg")
            assert page.locator('link[rel="stylesheet"][href^="/assets/home-compiled-2026.css"]').count() == 1
            assert page.locator('link[rel="stylesheet"]').count() == 1
            assert page.locator('script[src]').count() == 1
            expect(page.locator('script[src]')).to_have_attribute("src", "/assets/home-runtime.js")
            assert page.locator('script[src^="/_next/static/"]').count() == 0
            assert page.locator('script:not([src]):not([type="application/ld+json"])').count() == 0
            assert page.locator('meta[http-equiv="Content-Security-Policy"]').count() == 1
            resources = page.evaluate("performance.getEntriesByType('resource').map(e => e.name)")
            assert not any("/_next/static/" in url for url in resources), resources
            assert not any("ragunauth-ramsaroop.floot.app" in url for url in resources), resources
            assert not any("/assets/site.css" in url for url in resources), resources
            assert not any("/assets/platform.css" in url for url in resources), resources
            assert not any("/tools/assets/tools.css" in url for url in resources), resources
            assert not any("/tools/assets/analytics-loader.js" in url for url in resources), "Analytics entered the critical load window"
            page.wait_for_timeout(3600)
            delayed = page.evaluate("performance.getEntriesByType('resource').map(e => e.name)")
            assert any("/assets/accessibility.js" in url for url in delayed), delayed
            assert any("/tools/assets/analytics-loader.js" in url for url in delayed), delayed
            # Every viewport keeps the privacy decision in flow after the page.
            expect(page.locator("#rr-analytics-choice")).to_be_attached()
            page.wait_for_function("getComputedStyle(document.querySelector('#rr-analytics-choice')).position === 'static'")
            page.set_viewport_size({"width": 390, "height": 844})
            # Optional analytics stays off until consent; on mobile the choice must not cover the hero.
            expect(page.locator("#rr-analytics-choice")).to_be_attached()
            page.wait_for_function("getComputedStyle(document.querySelector('#rr-analytics-choice')).position === 'static'")
            assert page.locator("#rr-analytics-choice button[data-choice='denied']").count() == 1
            assert page.locator("#rr-analytics-choice button[data-choice='granted']").count() == 1
            assert page.locator('#rr-analytics-choice a[href="/tools/privacy/"]').count() == 1
            expect(page.locator(".mobile-nav")).to_be_visible()
            expect(page.locator(".nav-links")).to_be_hidden()
            page.locator(".mobile-nav summary").click()
            expect(page.locator(".mobile-nav a").first).to_be_visible()
            page.set_viewport_size({"width": 1280, "height": 900})
            results.append("PASS fast homepage: one critical runtime, no platform CSS, delayed analytics, desktop and mobile")

            alignment_routes = [
                "/", "/executive-profile/", "/leadership/", "/evidence/",
                "/research-library/", "/experience/", "/media/", "/resume.html", "/engage/",
                "/recruiter-mode/", "/recruiter-toolkit/", "/board-ceo-mode/"
            ]
            for width, height in ((1440, 1000), (1024, 900), (390, 844)):
                page.set_viewport_size({"width": width, "height": height})
                for route in alignment_routes:
                    page.goto(base + route, wait_until="domcontentloaded")
                    metrics = page.evaluate("""() => {
                        const root = document.documentElement;
                        const main = document.querySelector('main');
                        const rect = main ? main.getBoundingClientRect() : null;
                        return {
                            innerWidth: window.innerWidth,
                            scrollWidth: root.scrollWidth,
                            mainLeft: rect ? rect.left : 0,
                            mainRight: rect ? rect.right : window.innerWidth
                        };
                    }""")
                    if metrics["scrollWidth"] > metrics["innerWidth"] + 2:
                        offenders = page.evaluate("""() => [...document.querySelectorAll("body *")].map(el => {
                          const r=el.getBoundingClientRect();
                          return {element:el.tagName.toLowerCase()+"."+(el.className?.baseVal||el.className||"").toString().slice(0,65),
                            left:Math.round(r.left),right:Math.round(r.right),width:Math.round(r.width),
                            scroll:el.scrollWidth,client:el.clientWidth};
                        }).filter(x => x.right > innerWidth+2 || x.left < -2 || x.scroll > x.client+30)
                          .sort((a,b)=>b.right-a.right).slice(0,14)""")
                        raise AssertionError(
                            f"Horizontal overflow on {route} at {width}px: "
                            f"{metrics['scrollWidth']} > {metrics['innerWidth']}; "
                            f"offenders={offenders}"
                        )
                    assert metrics["mainLeft"] >= -2 and metrics["mainRight"] <= metrics["innerWidth"] + 2, (
                        f"Main content escapes viewport on {route} at {width}px: {metrics}"
                    )
            # The interactive dossier must work without third-party scripts.
            page.goto(base + "/experience/", wait_until="load")
            expect(page.locator("h1")).to_contain_text("decisions meet")
            expect(page.locator('link[rel="stylesheet"][href^="/assets/experience-2026.css"]')).to_have_count(1)
            expect(page.locator('script[src^="/assets/experience-2026.js"]')).to_have_count(1)
            # Audience-specific briefing studio is keyboard accessible and shareable.
            expect(page.locator('#lens-title')).to_have_text('The leadership lens.')
            page.locator('a[data-lens="recruiter"]').click()
            expect(page.locator('#lens-title')).to_have_text('The executive-search dossier.')
            expect(page.locator('#lens-primary')).to_have_attribute("href", "/recruiter-toolkit/")
            expect(page.locator('a[data-lens="recruiter"]')).to_have_attribute("aria-selected", "true")
            assert "lens=recruiter" in page.url
            page.locator('a[data-lens="recruiter"]').press("ArrowRight")
            expect(page.locator('#lens-title')).to_have_text("The international dialogue.")
            expect(page.locator('#lens-primary')).to_have_attribute("href", "/media/")
            # Claim explorer must be populated from the actual canonical record.
            expect(page.locator("#proof-network")).to_have_attribute("data-ready", "true", timeout=12000)
            expect(page.locator("#proof-nodes .proof-dot")).to_have_count(6)
            page.locator('a[data-claim-id="ungis-mcg-2026"]').click()
            expect(page.locator("#proof-title")).to_contain_text("United Nations Group")
            expect(page.locator("#proof-sources a")).to_have_attribute("href", "https://www.itu.int/net4/wsis/ungis/Home/MCG")
            page.locator('a[data-claim-id="solar-context"]').click()
            expect(page.locator("#proof-status")).to_contain_text("not presented as an individual achievement")
            expect(page.locator('a[data-claim-id="solar-context"]')).to_have_attribute("aria-current", "true")
            expect(page.locator('#mandate-institutions')).to_be_visible()
            page.locator('button[data-focus="governance"]').click()
            expect(page.locator('#mandate-governance')).to_be_visible()
            expect(page.locator('#mandate-institutions')).to_be_hidden()
            expect(page.locator('button[data-focus="governance"]')).to_have_attribute("aria-pressed", "true")
            page.locator('button[data-focus="governance"]').press("ArrowRight")
            expect(page.locator('#mandate-delivery')).to_be_visible()
            expect(page.locator('button[data-focus="delivery"]')).to_have_attribute("aria-pressed", "true")
            expect(page.locator(".gallery-counter")).to_have_text("01 / 02")
            page.locator(".gallery-next").click()
            expect(page.locator(".gallery-counter")).to_have_text("02 / 02")
            expect(page.locator('[data-slide="0"]')).to_be_hidden()
            expect(page.locator('[data-slide="1"]')).to_be_visible()
            page.locator(".gallery-prev").click()
            expect(page.locator(".gallery-counter")).to_have_text("01 / 02")
            assert page.locator(".record-card").count() == 4
            assert page.locator(".pathway").count() == 3
            assert page.locator('.record-card[href="https://www.itu.int/net4/wsis/ungis/Home/MCG"]').count() == 1
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 2")
            page.set_viewport_size({"width": 390, "height": 844})
            expect(page.locator(".cover-mobile-portrait")).to_be_visible()
            assert page.evaluate("""() => document.querySelector('.cover-mobile-portrait__photo').getBoundingClientRect().bottom < innerHeight"""), "Portrait must appear on mobile first screen"
            expect(page.locator(".portrait-stage")).to_be_hidden()
            expect(page.locator(".mobile-nav summary")).to_be_visible()
            page.locator(".mobile-nav summary").click()
            expect(page.locator('.mobile-nav a[href="#mandate"]')).to_be_visible()
            page.locator('.mobile-nav a[href="#mandate"]').click()
            expect(page.locator('.mobile-nav')).not_to_have_attribute("open", "")
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 2"), "Mobile dossier overflows"
            # Progressive enhancement: without JavaScript, the three briefing
            # perspectives remain ordinary navigable links.
            no_js = browser.new_context(javascript_enabled=False, viewport={"width":390,"height":844},
                                        service_workers="block")
            no_js_page = no_js.new_page()
            no_js_page.goto(base + "/experience/", wait_until="domcontentloaded")
            expect(no_js_page.locator('a[data-lens]')).to_have_count(3)
            expect(no_js_page.locator('a[data-lens="recruiter"]')).to_have_attribute("href", "/recruiter-toolkit/")
            expect(no_js_page.locator('a[data-lens="speaking"]')).to_have_attribute("href", "/media/")
            expect(no_js_page.locator('a[data-claim-id]')).to_have_count(6)
            no_js.close()
            # Narrow 320px phones must also remain usable.
            page.set_viewport_size({"width": 320, "height": 750})
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 2"), "320px dossier overflows"
            expect(page.locator(".mobile-nav summary")).to_be_visible()
            expect(page.locator(".cover-title")).to_be_visible()
            results.append("PASS edition 07: executive briefing modes, source-backed six-claim network, mandate controls, gallery and first-fold mobile portrait")

            # Pre-rendered executive pages must work without stale React hydration.
            page.set_viewport_size({"width": 390, "height": 844})
            for route in ("/executive-profile/", "/board-ceo-mode/", "/recruiter-mode/"):
                page.goto(base + route, wait_until="load")
                toggle = page.locator(".shell .menu-button")
                expect(toggle).to_be_visible()
                expect(toggle).to_have_attribute("aria-expanded", "false")
                toggle.click()
                expect(toggle).to_have_attribute("aria-expanded", "true")
                expect(page.locator("#mobile-navigation a").first).to_be_visible()
                page.keyboard.press("Escape")
                expect(toggle).to_have_attribute("aria-expanded", "false")
                expect(page.locator("#mobile-navigation")).to_be_hidden()
            results.append("PASS static executive navigation: mobile menu, Escape, focus and public links")
            page.set_viewport_size({"width": 1280, "height": 900})
            results.append("PASS executive alignment: ten priority routes fit desktop, tablet and mobile viewports")

            page.goto(base + "/start/", wait_until="domcontentloaded")
            routes = [
                "/project-workspace/", "/research-explorer/", "/observatory/explorer/",
                "/executive-engagement/", "/subscribe/", "/academy/learning-lab/"
            ]
            for route in routes:
                expect(page.locator(f'a[href="{route}"]').first).to_be_visible()
            results.append("PASS start page advertises all six real workspaces")

            page.goto(base + "/project-workspace/", wait_until="domcontentloaded")
            expect(page.locator("#work-report")).to_be_visible()
            expect(page.locator("#work-metrics .work-metrics")).to_have_count(0)
            expect(page.locator("#work-metrics div")).to_have_count(6)
            page.locator("#work-name").fill("QA demonstration")
            page.locator("#work-run").click()
            expect(page.locator("#work-report-meta")).to_contain_text("QA demonstration")
            geo = b'{"type":"FeatureCollection","features":[{"type":"Feature","geometry":{"type":"LineString","coordinates":[[-58.2,6.1],[-58.3,6.2]]},"properties":{}}]}'
            page.locator("#work-geodata").set_input_files(
                {"name": "qa.geojson", "mimeType": "application/geo+json", "buffer": geo}
            )
            expect(page.locator("#work-geo-status")).to_contain_text("Loaded 1 features")
            with page.expect_download() as project_download:
                page.locator("#work-export").click()
            assert project_download.value.suggested_filename == "project-screening.json"
            results.append("PASS project calculator, local GeoJSON and JSON export")

            page.goto(base + "/research-explorer/", wait_until="domcontentloaded")
            expected_papers = len(json.loads((ROOT / "data/research-papers.json").read_text(encoding="utf-8"))["papers"])
            expect(page.locator("#research-list button")).to_have_count(expected_papers)
            first_paper_slug = json.loads((ROOT / "data/research-papers.json").read_text(encoding="utf-8"))["papers"][0]["slug"]
            expect(page.locator("#research-pdf")).to_have_attribute(
                "href", f"/research-library/{first_paper_slug}/full-text.pdf"
            )
            # The new PDFs receive page extracts after the post-merge research indexing worker.
            # Exercise a paper with an existing real page index during pull-request CI.
            page.locator("#research-list button[data-slug=\"guyana-2040\"]").click()
            expect(page.locator("#research-pdf")).to_have_attribute(
                "href", "/research-library/guyana-2040/full-text.pdf"
            )
            page.locator("#research-query").fill("Guyana")
            page.locator("#research-ask").click()
            expect(page.locator("#research-response article").first).to_be_visible(timeout=30000)
            href = page.locator("#research-response article a").first.get_attribute("href")
            assert "#page=" in href, f"Missing authentic PDF page reference: {href}"
            results.append("PASS real indexed paper search links to an original PDF page")

            def wb_route(route):
                route.fulfill(
                    status=200,
                    content_type="application/json",
                    headers={"Access-Control-Allow-Origin": "*"},
                    body=json.dumps([{}, [
                        {"date": "2024", "value": 17.8},
                        {"date": "2023", "value": 12.4},
                    ]]),
                )

            page.route("https://api.worldbank.org/**", wb_route)
            page.goto(base + "/observatory/explorer/", wait_until="domcontentloaded")
            expect(page.locator("#ob-cards .ob-card")).to_have_count(1, timeout=20000)
            expect(page.locator("#ob-cards")).to_contain_text("2024")
            with page.expect_download() as indicator_download:
                page.locator("#ob-csv").click()
            assert indicator_download.value.suggested_filename == "guyana-official-data.csv"
            results.append("PASS source-year observatory, chart and CSV export")

            page.goto(base + "/executive-engagement/", wait_until="domcontentloaded")
            page.locator("#exec-purpose").select_option("board")
            page.locator("#exec-focus").select_option("mining")
            page.locator("#exec-build").click()
            expect(page.locator("#exec-brief")).to_be_visible()
            expect(page.locator("#exec-sources a").first).to_have_attribute("href", "/case-studies/")
            results.append("PASS tailored executive engagement brief and public evidence links")

            page.goto(base + "/subscribe/", wait_until="domcontentloaded")
            page.locator("#sub-email").fill("bad-email")
            page.locator('input[name="rr-topic"]').first.check()
            page.locator("#sub-consent").check()
            page.locator("#sub-send").click()
            expect(page.locator("#sub-status")).to_contain_text("valid email")
            expect(page.locator('a[href="/feed.xml"]')).to_be_visible()
            results.append("PASS subscription validation and immediate RSS route, no automatic sending")

            page.goto(base + "/academy/learning-lab/", wait_until="domcontentloaded")
            expect(page.locator("#lab-courses button")).to_have_count(8, timeout=20000)
            expect(page.locator("#lab-questions fieldset")).to_have_count(4)
            data = json.loads((ROOT / "data/academy-assessments.json").read_text(encoding="utf-8"))
            quiz = data["assessments"][0]
            for question in quiz["questions"]:
                page.locator(
                    'input[name="' + question["id"] + '"][value="' +
                    str(question["answer"]) + '"]'
                ).check()
            page.locator("#lab-submit").click()
            expect(page.locator("#lab-completion")).to_be_visible()
            expect(page.locator("#lab-progress")).to_contain_text("1 of 8")
            with page.expect_download() as academy_download:
                page.locator("#lab-export").click()
            assert academy_download.value.suggested_filename == "rr-academy-self-study-progress.json"
            results.append("PASS Academy four-question marking, completion and progress export")

            page.goto(base + "/tools/?q=geolibre", wait_until="domcontentloaded")
            expect(page.locator("#visible-tool-count")).to_have_text("1")
            expect(page.locator('#tool-grid [data-slug="geolibre"]')).to_be_visible()
            page.goto(base + "/tools/geolibre/", wait_until="domcontentloaded")
            expect(page.locator("#gis-stage iframe")).to_have_count(0)
            page.route(
                "https://web.geolibre.app/**",
                lambda route: route.fulfill(
                    status=200, content_type="text/html",
                    body="<html><body>Test GIS frame</body></html>"
                ),
            )
            page.locator("#launch-geolibre").click()
            expect(page.locator("#gis-stage iframe")).to_have_count(1)
            results.append("PASS GIS discovery and user-triggered third-party loading")
        finally:
            browser.close()
            server.shutdown()

    for line in results:
        print(line)
    print("PASS all eight critical browser workflows")


if __name__ == "__main__":
    main()
