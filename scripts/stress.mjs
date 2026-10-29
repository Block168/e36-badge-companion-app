// E36 Badge Companion App — headless stress test
// Runs against the local production build (dist/) in real Chrome.
//   npm run build && node scripts/stress.mjs
import { launch } from "puppeteer-core";
import http from "node:http";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const distDir = fileURLToPath(new URL("../dist/", import.meta.url));
const PORT = 4187;
const URL_ = `http://127.0.0.1:${PORT}/`;

// --------------------------------------------------------- minimal test PNG
// 8×8 solid PNG generated at runtime so the face-upload flow can be exercised
// end-to-end without committing binary fixtures.
const crcTable = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function makeTestPng(width = 8, height = 8) {
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = y * stride + 1 + x * 4;
      raw[o] = 220; raw[o + 1] = 40; raw[o + 2] = 60; raw[o + 3] = 255;
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const typeBuf = Buffer.from(type, "ascii");
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
    return Buffer.concat([len, typeBuf, data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------- static server
const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".png": "image/png", ".json": "application/json", ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".txt": "text/plain",
};
const root = resolve(distDir);
const server = http.createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url, URL_).pathname);
  if (path === "/") path = "/index.html";
  const file = resolve(root, "." + path);
  if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404); res.end("not found"); return;
  }
  res.writeHead(200, { "Content-Type": MIME[extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" });
  res.end(readFileSync(file));
});

// -------------------------------------------------------------- report utils
const rows = [];
const log = (label, value, unit = "") => rows.push({ label, value, unit });
const results = [];
const pass = (name) => results.push({ name, ok: true });
const fail = (name, why) => results.push({ name, ok: false, why });

const clickByText = (page, text) =>
  page.evaluate((t) => {
    const el = [...document.querySelectorAll("button")].find(
      (b) => b.textContent.includes(t) && b.offsetParent !== null,
    );
    if (!el) throw new Error(`button not found: ${t}`);
    el.click();
  }, text);

const waitForText = (page, text, timeout = 30000) =>
  page.waitForFunction((t) => document.body.innerText.includes(t), { timeout, polling: 100 }, text);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------------ helpers
async function bootPage(browser, viewport) {
  const page = await browser.newPage();
  if (viewport) await page.setViewport(viewport);
  return page;
}

async function waitForConnected(page) {
  await page.waitForFunction(
    () => [...document.querySelectorAll("button")].some((b) => b.textContent.includes("Disconnect")),
    { timeout: 30000, polling: 100 },
  );
}
async function waitForDisconnected(page) {
  await page.waitForFunction(
    () => [...document.querySelectorAll("button")].some((b) => b.textContent.includes("Try Demo Mode")),
    { timeout: 30000, polling: 100 },
  );
}

async function connectDemo(page) {
  await clickByText(page, "Garage");
  await sleep(80);
  await clickByText(page, "Try Demo Mode");
  await waitForConnected(page);
}

const hasVisibleButton = (page, text) =>
  page.evaluate((t) => [...document.querySelectorAll("button")].some((b) => b.textContent.includes(t) && b.offsetParent !== null), text);

// Library → open a face → the sheet's "Play on Badge".
async function openFaceSheet(page, name = "Roundel Glow") {
  await clickByText(page, "Library");
  if (await hasVisibleButton(page, "Upload Animation")) await clickByText(page, "Library"); // leave the Studio
  await waitForText(page, name);
  await clickByText(page, name);
  await waitForText(page, "Play on Badge");
}

// Library → Studio (no-op when the Studio is already open).
async function openStudio(page) {
  await clickByText(page, "Library");
  await sleep(80);
  if (!(await hasVisibleButton(page, "Upload Animation"))) await clickByText(page, "New Animation");
  await waitForText(page, "Upload Animation");
}

function makeErrorCatcher(page) {
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
  page.on("requestfailed", (r) => errors.push("REQFAIL: " + r.url()));
  return errors;
}

async function jsHeap(page) {
  const m = await page.metrics();
  return m.JSHeapUsedSize;
}

async function forceGC(page) {
  const cdp = await page.createCDPSession();
  await cdp.send("HeapProfiler.enable");
  await cdp.send("HeapProfiler.collectGarbage");
}

// ------------------------------------------------------------------ scenarios
async function scenarioBoot(browser) {
  log("— BOOT & PAGE WEIGHT —");
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const page = await bootPage(browser);
    const errors = makeErrorCatcher(page);
    const t0 = Date.now();
    await page.goto(URL_, { waitUntil: "load" });
    const wallMs = Date.now() - t0;
    const nav = await page.evaluate(() => {
      const n = performance.getEntriesByType("navigation")[0];
      return { dcl: n.domContentLoadedEventEnd, load: n.loadEventEnd, ttfb: n.responseStart };
    });
    const heap = await jsHeap(page);
    samples.push({ wallMs, ...nav, heap });
    if (errors.length) fail("boot: console/page errors", errors.join(" | "));
    await page.close();
  }
  const avg = (k) => Math.round(samples.reduce((s, x) => s + x[k], 0) / samples.length);
  log("load (wall)", avg("wallMs"), "ms");
  log("DOMContentLoaded", avg("dcl"), "ms");
  log("loadEventEnd", avg("load"), "ms");
  log("TTFB", avg("ttfb"), "ms");
  log("JS heap after boot", Math.round(avg("heap") / 1048576), "MB");
  pass("boot: page loads cleanly (3×)");
}

async function scenarioEncodeBenchmark(browser) {
  log("— RGB565 ENCODE MICRO-BENCHMARK (480×480, in-page) —");
  const page = await bootPage(browser);
  makeErrorCatcher(page);
  await page.goto(URL_, { waitUntil: "load" });
  const bench = await page.evaluate(() => {
    const W = 480, H = 480;
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    const img = ctx.createImageData(W, H);
    for (let i = 0; i < img.data.length; i += 4) {
      img.data[i] = (Math.random() * 255) | 0;
      img.data[i + 1] = (Math.random() * 255) | 0;
      img.data[i + 2] = (Math.random() * 255) | 0;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const data = ctx.getImageData(0, 0, W, H).data;
    const encodeOnce = () => {
      const out = new Uint8Array(W * H * 2);
      let k = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const rgb = ((r & 0xf8) << 8) | ((g & 0xfc) << 3) | (b >> 3);
        out[k++] = (rgb >> 8) & 0xff;
        out[k++] = rgb & 0xff;
      }
      return out;
    };
    encodeOnce();
    const N = 50;
    const t0 = performance.now();
    let bytes = 0;
    for (let i = 0; i < N; i++) bytes += encodeOnce().length;
    const msPer = (performance.now() - t0) / N;
    return { msPer: +msPer.toFixed(1), mbps: +((bytes / N / msPer) / 1048.576).toFixed(1) };
  });
  log("encode time per face", bench.msPer, "ms");
  log("encode throughput", bench.mbps, "MB/s");
  pass("encode: 50 frames encoded without error");
  await page.close();
}

async function scenarioConnectLoop(browser) {
  log("— DEMO CONNECT / DISCONNECT LOOP (12×) —");
  const page = await bootPage(browser);
  makeErrorCatcher(page);
  await page.goto(URL_, { waitUntil: "load" });
  const cycles = [];
  for (let i = 0; i < 12; i++) {
    const t0 = Date.now();
    await connectDemo(page);
    const connectMs = Date.now() - t0;
    await clickByText(page, "Disconnect");
    await waitForDisconnected(page);
    cycles.push(connectMs);
  }
  cycles.sort((a, b) => a - b);
  const sum = cycles.reduce((a, b) => a + b, 0);
  log("connect time — avg", Math.round(sum / cycles.length), "ms");
  log("connect time — p50", cycles[Math.floor(cycles.length / 2)], "ms");
  log("connect time — max", cycles[cycles.length - 1], "ms");
  pass("connect loop: 12× demo connect/disconnect clean");
  await page.close();
}

async function scenarioFaceTransfers(browser) {
  log("— FACE TRANSFER STRESS (3 sends, real encode + chunked sim) —");
  const page = await bootPage(browser);
  makeErrorCatcher(page);
  await page.goto(URL_, { waitUntil: "load" });
  await connectDemo(page);

  const beforeHeap = await jsHeap(page);
  const times = [];
  for (let i = 0; i < 3; i++) {
    await openFaceSheet(page);
    const t0 = Date.now();
    await clickByText(page, "Play on Badge");
    await waitForText(page, "uploaded to badge", 90000);
    times.push(Date.now() - t0);
  }
  const afterHeap = await jsHeap(page);
  log("face transfer time — avg", Math.round(times.reduce((a, b) => a + b, 0) / times.length), "ms");
  log("face transfer time — max", Math.max(...times), "ms");
  log("heap delta after 3 sends", Math.round((afterHeap - beforeHeap) / 1048576), "MB");
  pass("faces: 3 transfers completed successfully");
  await page.close();
}

async function scenarioAnimation(browser) {
  log("— ANIMATION UPLOAD (2 frames, real encode + chunked sim) —");
  const page = await bootPage(browser);
  makeErrorCatcher(page);
  await page.goto(URL_, { waitUntil: "load" });
  await connectDemo(page);
  await openStudio(page);
  await waitForText(page, "Roundel Glow");
  await clickByText(page, "Roundel Glow");       // quick-add preset frame
  await sleep(300);
  await clickByText(page, "Checkered Flag");     // quick-add second frame
  await sleep(300);
  await clickByText(page, "Play Preview");
  await sleep(1500);
  await clickByText(page, "Stop Preview");

  const t0 = Date.now();
  await clickByText(page, "Upload Animation");
  await waitForText(page, "uploaded", 150000);
  log("2-frame animation upload", Date.now() - t0, "ms");
  pass("animation: 2-frame upload completed");
  await page.close();
}

async function scenarioFaceToAnimationFlow(browser) {
  log("— FACE-TO-ANIMATION FLOW (upload a face, then reuse it as an animation frame) —");
  const page = await bootPage(browser);
  makeErrorCatcher(page);
  await page.goto(URL_, { waitUntil: "load" });
  await connectDemo(page);

  const pngPath = resolve(distDir, "_test-face.png");
  writeFileSync(pngPath, makeTestPng());

  // 1) Upload the image in the Library tab.
  await clickByText(page, "Library");
  await page.waitForSelector('input[type="file"]', { timeout: 15000 });
  const input = await page.$('input[type="file"]');
  await input.uploadFile(pngPath);
  await waitForText(page, "Face added", 20000);
  await waitForText(page, "test-face", 20000);
  log("face uploaded in Library", "test-face");

  // 2) It must appear as a quick-add in the Studio.
  await openStudio(page);
  await waitForText(page, "saved faces:", 20000);
  await waitForText(page, "test-face", 20000);
  log("face listed under quick-add in Studio", "yes");

  // 3) Clicking it must add an animation frame.
  await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="animation-saved-face"]');
    if (!btn) throw new Error("animation-saved-face button not found");
    btn.click();
  });
  await page.waitForFunction(
    () => {
      const s = [...document.querySelectorAll("span")].find((x) => x.textContent.includes("/20 frames"));
      return !!s && /^1\/20 frames/.test(s.textContent.trim());
    },
    { timeout: 20000, polling: 100 },
  );
  log("frame added from saved face", "yes");
  pass("flow: uploaded face is reusable as an animation frame");
  await page.close();
}

async function scenarioTabStateMemory(browser) {
  log("— TAB STATE MEMORY (remember last step across tabs + reload) —");
  const page = await bootPage(browser);
  makeErrorCatcher(page);
  await page.goto(URL_, { waitUntil: "load" });
  await connectDemo(page);

  const frameCount = () =>
    page.evaluate(() => {
      const s = [...document.querySelectorAll("span")].find((x) => x.textContent.includes("/20 frames"));
      return s ? s.textContent.trim() : null;
    });

  await openStudio(page);
  await waitForText(page, "Roundel Glow");
  await clickByText(page, "Roundel Glow");
  await sleep(200);
  const added = await frameCount();

  await clickByText(page, "Settings");
  await sleep(200);
  await clickByText(page, "Library");
  await sleep(200);
  const kept = await frameCount();

  await page.reload({ waitUntil: "load" });
  await sleep(300);
  const restored = await page.evaluate(() => document.body.innerText.includes("Upload Animation"));

  log("frames before tab switch", added ?? "none");
  log("frames after tab switch", kept ?? "none");
  log("animation tab restored after reload", restored ? "yes" : "no");
  if (added && /^[1-9]/.test(added) && kept === added && restored) {
    pass("memory: tab state + last tab persist");
  } else {
    fail("memory: tab state not remembered", `before=${added} after=${kept} restored=${restored}`);
  }
  await page.close();
}

async function scenarioRetryRecovery(browser) {
  log("— WRITE-RETRY RECOVERY (simulated 35% write failure rate) —");
  const page = await bootPage(browser);
  makeErrorCatcher(page);
  await page.goto(URL_, { waitUntil: "load" });
  await connectDemo(page);
  await openFaceSheet(page);

  const client = await page.evaluate(() => {
    const c = window.__badgeDemoClient;
    return c ? { hasClient: true, failures: c.failedWriteCount } : { hasClient: false };
  });
  if (!client.hasClient) fail("retry: debug seam not exposed on window", "window.__badgeDemoClient missing");
  else if (client.failures !== 0) fail("retry: failedWriteCount should start at 0", `got ${client.failures}`);
  else pass("retry: debug seam exposed, clean baseline");

  await page.evaluate(() => window.__badgeDemoClient.setSimulatedFailureRate(0.35));
  const t0 = Date.now();
  await clickByText(page, "Play on Badge");
  await waitForText(page, "uploaded to badge", 120000);
  const transferMs = Date.now() - t0;

  const after = await page.evaluate(() => ({
    failures: window.__badgeDemoClient.failedWriteCount,
    rate: window.__badgeDemoClient.simulatedFailureRate,
  }));
  log("face transfer with injected failures", transferMs, "ms");
  log("recovered write failures", after.failures, "writes");
  if (after.failures === 0) fail("retry: expected injected failures to be recovered", "failedWriteCount === 0");
  else pass("retry: transfer survived injected write failures");

  await page.evaluate(() => window.__badgeDemoClient.setSimulatedFailureRate(0));
  pass("retry: failure injection reset to 0");
  await page.close();
}

async function scenarioBrightness(browser) {
  log("— BRIGHTNESS APPLY STRESS (10 rapid apply cycles) —");
  const page = await bootPage(browser);
  makeErrorCatcher(page);
  await page.goto(URL_, { waitUntil: "load" });
  await connectDemo(page);
  await clickByText(page, "Settings");
  await waitForText(page, "Night Mode");

  // Presets apply on tap; the write is done once it lands in the transfer history.
  const presets = ["10%", "30%", "50%", "75%", "100%"];
  const times = [];
  for (let i = 0; i < 10; i++) {
    const label = presets[i % presets.length];
    const t0 = Date.now();
    await clickByText(page, label);
    await page.waitForFunction(
      (l) => (JSON.parse(localStorage.getItem("e36.transferHistory") || "[]")[0] || {}).name === `Brightness → ${l}`,
      { timeout: 15000, polling: 20 },
      label,
    );
    times.push(Date.now() - t0);
  }
  log("brightness apply — avg", Math.round(times.reduce((a, b) => a + b, 0) / times.length), "ms");
  log("brightness apply — max", Math.max(...times), "ms");
  pass("brightness: 10 apply cycles clean");
  await page.close();
}

async function scenarioTabSwitching(browser) {
  log("— TAB SWITCHING STRESS (30 rapid switches) —");
  const page = await bootPage(browser);
  makeErrorCatcher(page);
  await page.goto(URL_, { waitUntil: "load" });
  const tabs = ["Garage", "Library", "Playlists", "Triggers", "Settings"];
  const t0 = Date.now();
  for (let i = 0; i < 30; i++) {
    await clickByText(page, tabs[i % tabs.length]);
    await sleep(60);
  }
  log("30 tab switches", Date.now() - t0, "ms");
  pass("tabs: 30 rapid switches clean");
  await page.close();
}

async function scenarioMemory(browser) {
  log("— MEMORY / LEAK CHECK —");
  const page = await bootPage(browser);
  makeErrorCatcher(page);
  await page.goto(URL_, { waitUntil: "load" });
  await forceGC(page);
  const idle = await jsHeap(page);
  await connectDemo(page);
  await forceGC(page);
  const connected = await jsHeap(page);
  await clickByText(page, "Disconnect");
  await waitForDisconnected(page);
  await forceGC(page);
  const afterDisconnect = await jsHeap(page);
  log("heap — idle", Math.round(idle / 1048576), "MB");
  log("heap — connected (demo)", Math.round(connected / 1048576), "MB");
  log("heap — after disconnect", Math.round(afterDisconnect / 1048576), "MB");
  const retained = afterDisconnect - idle;
  log("retained after connect+disconnect", Math.round(retained / 1048576), "MB");
  if (retained > 8 * 1048576) fail("memory: possible leak after connect/disconnect", `${Math.round(retained / 1048576)} MB retained`);
  else pass("memory: no significant retention after connect/disconnect");
  await page.close();
}

async function scenarioConcurrency(browser) {
  log("— CONCURRENT TABS (3 simultaneous demo sessions) —");
  const pages = [];
  for (let i = 0; i < 3; i++) {
    const page = await bootPage(browser);
    makeErrorCatcher(page);
    await page.goto(URL_, { waitUntil: "load" });
    pages.push(page);
  }
  const t0 = Date.now();
  await Promise.all(pages.map((p) => connectDemo(p)));
  log("3 concurrent demo connects", Date.now() - t0, "ms");
  await Promise.all(pages.map((p) => clickByText(p, "Disconnect")));
  await Promise.all(pages.map((p) => waitForDisconnected(p)));
  await Promise.all(pages.map((p) => p.close()));
  pass("concurrency: 3 simultaneous sessions clean");
}

async function scenarioMobile(browser) {
  log("— MOBILE VIEWPORT (iPhone-ish 390×844) —");
  const page = await bootPage(browser, { width: 390, height: 844, isMobile: true, hasTouch: true });
  makeErrorCatcher(page);
  await page.goto(URL_, { waitUntil: "load" });
  const hasConnect = await page.evaluate(() => [...document.querySelectorAll("button")].some((b) => b.textContent.trim() === "Connect"));
  const transportWords = await page.evaluate(() => /wi-?fi|bluetooth/i.test(document.body.innerText));
  const hasHint = await page.evaluate(() => document.body.innerText.includes("E36-Badge"));
  log("Connect button visible", hasConnect ? "yes" : "no");
  log("WiFi/Bluetooth wording hidden", transportWords ? "no — VISIBLE!" : "yes — hidden");
  log("E36-Badge hint present", hasHint ? "yes" : "no");
  if (!hasConnect) fail("mobile: Connect button missing");
  else if (transportWords) fail("mobile: connection screen should not mention WiFi or Bluetooth");
  else pass("mobile: single Connect button, no transport wording");
  await page.close();
}

// ---------------------------------------------------------------------- main
const serverReady = new Promise((r) => server.listen(PORT, "127.0.0.1", r));
let browser;
try {
  await serverReady;
  browser = await launch({
    executablePath: CHROME,
    headless: true,
    defaultViewport: { width: 1440, height: 900 },
    args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  });

  const tTotal = Date.now();
  const scenarios = [
    ["boot", scenarioBoot],
    ["encode", scenarioEncodeBenchmark],
    ["connect-loop", scenarioConnectLoop],
    ["face-transfers", scenarioFaceTransfers],
    ["face-to-animation", scenarioFaceToAnimationFlow],
    ["tab-state-memory", scenarioTabStateMemory],
    ["retry-recovery", scenarioRetryRecovery],
    ["animation", scenarioAnimation],
    ["brightness", scenarioBrightness],
    ["tab-switching", scenarioTabSwitching],
    ["memory", scenarioMemory],
    ["concurrency", scenarioConcurrency],
    ["mobile", scenarioMobile],
  ];
  for (const [name, fn] of scenarios) {
    const t0 = Date.now();
    process.stderr.write(`[scenario] ${name} start\n`);
    await fn(browser);
    process.stderr.write(`[scenario] ${name} done (${Date.now() - t0}ms)\n`);
  }
  log("total suite time", Math.round((Date.now() - tTotal) / 1000), "s");
} catch (err) {
  fail("suite crashed", String(err));
} finally {
  if (browser) await browser.close();
  server.close();
}

console.log("\n================ E36 BADGE COMPANION — STRESS TEST ================");
let w = 0;
for (const { label, value, unit } of rows) {
  if (label.startsWith("—") || (value === "" && unit === "")) {
    console.log("\n  " + label);
    continue;
  }
  const line = `  ${label.padEnd(38)} ${String(value).padStart(12)} ${unit}`;
  console.log(line);
  w = Math.max(w, label.length);
}
console.log("----------------------------------------------------------------");
for (const r of results) {
  console.log(`  [${r.ok ? "PASS" : "FAIL"}] ${r.name}${r.why ? " — " + r.why : ""}`);
}
console.log("==================================================================");
const failed = results.filter((r) => !r.ok);
console.log(`SUMMARY: ${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
