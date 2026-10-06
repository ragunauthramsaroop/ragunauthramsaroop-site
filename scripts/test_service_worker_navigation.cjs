"use strict";
// Simulate browser service-worker fetch events to prevent incorrect offline routes.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const source = fs.readFileSync("service-worker.js", "utf8");
const listeners = {};
const stores = new Map();
let networkWorks = false;

function urlFor(req) {
  return new URL(typeof req === "string" ? req : req.url, "https://ragunauthramsaroop.com").href;
}
function makeCache(store) {
  return {
    async add(req) {
      const url = urlFor(req);
      const type = url.endsWith(".css") ? "text/css" : url.endsWith(".js") ? "application/javascript" : url.endsWith(".png") ? "image/png" : "text/html";
      store.set(url, new Response("Precached: " + url, { headers: { "Content-Type": type } }));
    },
    async match(req, options = {}) {
      const target = urlFor(req);
      let found = store.get(target);
      if (!found && options.ignoreSearch) {
        found = [...store.entries()].find(([key]) => new URL(key).pathname === new URL(target).pathname)?.[1];
      }
      return found?.clone();
    },
    async put(req, response) { store.set(urlFor(req), response.clone()); },
    async keys() { return [...store.keys()].map(url => ({ url })); },
    async delete(req) { return store.delete(urlFor(req)); }
  };
}
const cacheAPI = {
  async open(name) {
    if (!stores.has(name)) stores.set(name, new Map());
    return makeCache(stores.get(name));
  },
  async keys() { return [...stores.keys()]; },
  async delete(name) { return stores.delete(name); }
};
const fakeSelf = {
  location: { origin: "https://ragunauthramsaroop.com" },
  addEventListener(name, callback) { listeners[name] = callback; },
  async skipWaiting() {},
  clients: { async claim() {} }
};
vm.runInNewContext(source, {
  self: fakeSelf, caches: cacheAPI, URL, Response, Promise,
  async fetch(req) {
    if (!networkWorks) throw Error("Simulated TLS/network failure");
    const url = urlFor(req);
    const type = url.includes(".css") ? "text/css" : url.includes(".js") ? "application/javascript" : "text/html";
    return new Response("Network response for " + url, {
      headers: { "Content-Type": type }
    });
  }
}, { filename: "service-worker.js" });

async function eventFor(handler, request) {
  const background = [];
  let output;
  const ev = {
    request,
    waitUntil(p) { background.push(Promise.resolve(p)); },
    respondWith(p) { output = Promise.resolve(p); }
  };
  handler(ev);
  const response = await output;
  await Promise.all(background);
  return response;
}

(async () => {
  assert.ok(source.includes('const V="rr-public-v14"'), "Version should be v14");
  stores.set("rr-public-v13", new Map());
  stores.set("some-other-app", new Map());
  const installWork = [];
  listeners.install({ waitUntil(p) { installWork.push(Promise.resolve(p)); } });
  await Promise.all(installWork);
  const activateWork = [];
  listeners.activate({ waitUntil(p) { activateWork.push(Promise.resolve(p)); } });
  await Promise.all(activateWork);
  assert.equal(stores.has("rr-public-v13"), false, "Retire prior RR cache on upgrade");
  assert.equal(stores.has("some-other-app"), true, "Never delete unrelated caches");

  const cache = await cacheAPI.open("rr-public-v14");
  assert.equal(await cache.match("/"), undefined, "Homepage HTML should not inflate the eager install shell");
  assert.equal(await cache.match("/assets/home.css"), undefined, "Homepage CSS should load on demand instead of inflating the eager install shell");
  assert.ok(await cache.match("/assets/home-runtime.js"), "Homepage runtime should remain available offline");
  assert.ok(await cache.match("/assets/accessibility.css"), "Accessibility CSS should remain available offline");
  assert.equal(await cache.match("/start/"), undefined, "Start page must not compete with homepage loading");
  assert.equal(await cache.match("/assets/site.css"), undefined, "Large site CSS must be on demand");
  assert.equal(await cache.match("/tools/assets/tools.css"), undefined, "Tools CSS must be on demand");

  const home = { url: "https://ragunauthramsaroop.com/", mode: "navigate", method: "GET" };
  let page = await eventFor(listeners.fetch, home);
  assert.equal(page.status, 503, "A never-visited homepage should fail explicitly when the network is unavailable");
  assert.match(await page.text(), /Connection unavailable/);

  networkWorks = true;
  page = await eventFor(listeners.fetch, home);
  assert.equal(page.status, 200, "Online homepage navigation should return the requested page");
  assert.match(await page.text(), /Network response/);
  assert.ok(await cache.match("/"), "Successful homepage navigation should seed the canonical offline root cache");

  let homeCss = await eventFor(listeners.fetch, {
    url: "https://ragunauthramsaroop.com/assets/home.css?v=compat",
    mode: "same-origin", method: "GET"
  });
  assert.equal(homeCss.status, 200, "Homepage CSS should load on demand");

  networkWorks = false;
  page = await eventFor(listeners.fetch, home);
  assert.equal(page.status, 200, "A previously visited homepage should open from the exact cached route");
  assert.match(await page.text(), /Network response/);
  homeCss = await eventFor(listeners.fetch, {
    url: "https://ragunauthramsaroop.com/assets/home.css?v=offline",
    mode: "same-origin", method: "GET"
  });
  assert.equal(homeCss.status, 200, "Previously fetched cache-busted homepage CSS should work offline");

  const geo = { url: "https://ragunauthramsaroop.com/tools/geolibre/", mode: "navigate", method: "GET" };
  page = await eventFor(listeners.fetch, geo);
  assert.equal(page.status, 503, "A failed GIS request must be an explicit offline error");
  assert.match(await page.text(), /Connection unavailable/);
  assert.equal(page.headers.get("Cache-Control"), "no-store");

  networkWorks = true;
  page = await eventFor(listeners.fetch, geo);
  assert.equal(page.status, 200, "Successful requests must return the requested page");
  assert.match(await page.text(), /Network response/);

  networkWorks = false;
  page = await eventFor(listeners.fetch, {
    ...geo, url: geo.url + "?reconnect=1"
  });
  assert.equal(page.status, 200, "Previously visited exact page should work offline");
  assert.match(await page.text(), /Network response/);

  const unknown = await eventFor(listeners.fetch, {
    url: "https://ragunauthramsaroop.com/not-visited/", mode: "navigate", method: "GET"
  });
  assert.equal(unknown.status, 503, "No unrelated offline page substitution");
  assert.doesNotMatch(await unknown.text(), /What brought you here/);

  networkWorks = true;
  let css = await eventFor(listeners.fetch, {
    url: "https://ragunauthramsaroop.com/tools/assets/tools.css",
    mode: "same-origin", method: "GET"
  });
  assert.equal(css.status, 200, "Tool CSS should load on demand");
  networkWorks = false;
  css = await eventFor(listeners.fetch, {
    url: "https://ragunauthramsaroop.com/tools/assets/tools.css",
    mode: "same-origin", method: "GET"
  });
  assert.equal(css.status, 200, "Visited tool CSS should then work offline");

  console.log("PASS: lean install shell, exact cached homepage after first visit, deferred assets, offline route integrity, cache migration");
})().catch(err => { console.error(err); process.exitCode = 1; });
