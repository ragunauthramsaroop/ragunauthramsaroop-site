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
            expect(page.locator('.nav-links a[href="/resume.html"]')).to_be_visible()
            expect(page.locator("body")).to_contain_text("Liaison Director, Social Responsibility Department")
            expect(page.locator("body")).to_contain_text("CREF 2026")
            assert "five role progressions" not in page.locator("body").inner_text().lower()
            expect(page.locator(".hero-portrait img")).to_have_attribute("width", "800")
            expect(page.locator(".hero-portrait img")).to_have_attribute("height", "1030")
            expect(page.locator(".hero-portrait img")).to_have_attribute("src", "/assets/randy-portrait.jpg")
            assert page.locator('link[href^="/assets/home.css"]').count() == 1
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
            page.set_viewport_size({"width": 390, "height": 844})
            expect(page.locator(".mobile-nav")).to_be_visible()
            expect(page.locator(".nav-links")).to_be_hidden()
            page.locator(".mobile-nav summary").click()
            expect(page.locator(".mobile-nav a").first).to_be_visible()
            page.set_viewport_size({"width": 1280, "height": 900})
            results.append("PASS fast homepage: one critical runtime, no platform CSS, delayed analytics, desktop and mobile")

            alignment_routes = [
                "/", "/executive-profile/", "/leadership/", "/evidence/",
                "/research-library/", "/media/", "/resume.html", "/engage/",
                "/recruiter-mode/", "/board-ceo-mode/"
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
                    assert metrics["scrollWidth"] <= metrics["innerWidth"] + 2, (
                        f"Horizontal overflow on {route} at {width}px: "
                        f"{metrics['scrollWidth']} > {metrics['innerWidth']}"
                    )
                    assert metrics["mainLeft"] >= -2 and metrics["mainRight"] <= metrics["innerWidth"] + 2, (
                        f"Main content escapes viewport on {route} at {width}px: {metrics}"
                    )
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
