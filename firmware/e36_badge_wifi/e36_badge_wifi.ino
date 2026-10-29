/*
 * E36 Badge — WiFi Companion Firmware
 * ------------------------------------
 * The badge runs as a WiFi soft-AP. Phones join the "E36-Badge" network and the
 * companion web app opens automatically (captive portal). The app is served
 * from this device and talks to the REST API below — works identically on iOS
 * and Android with no Bluetooth, no app store, and no internet required.
 *
 * OPTIONAL — serve the full web app from the badge:
 *   Run  .\firmware\embed_webapp.ps1 -Html dist\index.html -Out firmware\e36_badge_wifi\web_index_html.h
 *   after `npm run build`. If web_index_html.h is present it is embedded and
 *   served at "/". Without it, a minimal status page is served instead.
 *
 * DISPLAY INTEGRATION:
 *   Faces are 480x480 RGB565 (460,800 bytes/frame). Implement the hooks at the
 *   bottom of this file to push pixels to your display driver:
 *     - onFaceUploaded(path, bytes)      -> show / store the face
 *     - onAnimationUploaded(path, bytes) -> 6-byte header, then raw frames
 *     - onLiveFrame(path, bytes)         -> flash a single frame (live test mode)
 *     - onConfigLoaded(active, brightness) -> called at boot with persisted state
 *     - applyBrightness(value)           -> drive the backlight
 *     - readBatteryPercent()             -> read the PMIC/ADC
 *
 * PERSISTENCE:
 *   Brightness is saved to NVS (Preferences). The active item (face vs
 *   animation) is saved to /config.json on LittleFS and restored at boot, so
 *   the badge remembers its look across power cycles.
 *
 * API:
 *   GET  /api/info                        -> device info JSON (incl. storage use)
 *   POST /api/brightness  {"value": 0..100}
 *   POST /api/face        multipart file field "file" (raw RGB565)
 *   POST /api/animation   multipart file field "file" (header + RGB565 frames)
 *   POST /api/frame       multipart file field "file" (raw RGB565, live test)
 *   GET  /api/faces/latest                -> last uploaded raw face
 *   GET  /api/anims/latest                -> last uploaded raw animation
 *   GET  /api/frame/latest                -> last live-tested raw frame
 *   GET  /api/config                      -> {"active":"...","brightness":..}
 *   POST /api/config      {"active":"face"|"animation"}
 *
 * UPLOAD LIMITS:
 *   A face is 460,800 bytes; a 20-frame animation is 9,216,006 bytes. Uploads
 *   are refused (HTTP 413) when they exceed MAX_UPLOAD or the free LittleFS
 *   space, and refused (HTTP 400) when the size doesn't match a valid face or
 *   animation. A refused upload never reports success and its partial file is
 *   deleted. Full 20-frame animations need ~9 MB of LittleFS, i.e. a 16 MB
 *   flash board; with 4 MB flash ("Huge APP") only about one face fits.
 *
 * Board: ESP32 Dev Module (Arduino core 2.x, Partition Scheme "Huge APP" if
 * you embed the web app). No external libraries required.
 */

#include <Arduino.h>
#include <WiFi.h>
#include <DNSServer.h>
#include <WebServer.h>
#include <LittleFS.h>
#include <Preferences.h>

// ---------------------------------------------------------------- config ---

#define AP_SSID       "E36-Badge"   // network name phones join
#define AP_PASSWORD   ""            // empty = open network
#define AP_CHANNEL    1

#define DISPLAY_W     480
#define DISPLAY_H     480
#define FACE_BYTES    (DISPLAY_W * DISPLAY_H * 2)   // 460,800
#define ANIM_HEADER   6                              // u16 count + u32 frameSize
#define MAX_FRAMES    20                             // must match the app's MAX_ANIMATION_FRAMES
#define MAX_UPLOAD    (ANIM_HEADER + MAX_FRAMES * FACE_BYTES)  // largest valid upload

#define PATH_FACE     "/faces/latest.rgb565"
#define PATH_ANIM     "/anims/latest.anim"
#define PATH_FRAME    "/frames/live.rgb565"
#define PATH_CONFIG   "/config.json"

// ------------------------------------------------------------------ state ---

WebServer server(80);
DNSServer dnsServer;
Preferences prefs;

static uint8_t  g_brightness = 70;
static int16_t  g_battery    = 86;   // overridden by readBatteryPercent()
static String   g_active     = "face";   // "face" | "animation" — shown at boot

static File     g_upFile;
static String   g_upTarget;
static size_t   g_upBytes = 0;
static size_t   g_upLimit = 0;       // max bytes this upload may write
static bool     g_upSpaceBound = false;  // true when free space, not format, sets g_upLimit
static bool     g_upOk    = false;
static int      g_upStatus = 200;    // HTTP status for the finished upload
static String   g_upError;           // reason when g_upOk is false

// ------------------------------------------------- embedded web app ---------

#if __has_include("web_index_html.h")
  #include "web_index_html.h"
  #define HAS_WEB_APP 1
#else
  #define HAS_WEB_APP 0
#endif

// Fallback page when the app hasn't been embedded yet.
static const char PROGMEM PORTAL_HTML[] =
  "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">"
  "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
  "<title>E36 Badge</title>"
  "<style>body{font-family:system-ui,sans-serif;background:#0a0a0a;color:#e4e4e7;"
  "display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}"
  "main{max-width:420px;padding:24px}h1{letter-spacing:.15em;font-size:20px}"
  "p{color:#a1a1aa;line-height:1.6}a{color:#38bdf8}</style></head><body>"
  "<main><h1>E36 BADGE</h1>"
  "<p>WiFi link is up. This badge is running the base firmware without the "
  "companion app embedded — build the web app and run "
  "<code>firmware/embed_webapp.ps1</code>, then reflash.</p>"
  "<p>API status: <a href=\"/api/info\">/api/info</a></p></main></body></html>";

// ------------------------------------------------------------- helpers -------

static size_t fileSize(const char *path) {
  if (!LittleFS.exists(path)) return 0;
  File f = LittleFS.open(path, "r");
  size_t n = f ? f.size() : 0;
  if (f) f.close();
  return n;
}

static void sendJson(const String &body) {
  server.sendHeader("Cache-Control", "no-cache");
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  server.send(200, "application/json", body);
}

static void sendJsonError(const String &msg, int status = 400) {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(status, "application/json",
              String("{\"ok\":false,\"error\":\"") + msg + "\"}");
}

static void sendAppOrPortal() {
  #if HAS_WEB_APP
    server.sendHeader("Cache-Control", "no-cache");
    server.setContentLength(WEB_INDEX_HTML_LEN);
    server.send(200, "text/html", "");
    const size_t CHUNK = 4096;
    for (size_t i = 0; i < WEB_INDEX_HTML_LEN; i += CHUNK) {
      size_t n = (i + CHUNK < WEB_INDEX_HTML_LEN) ? CHUNK : (WEB_INDEX_HTML_LEN - i);
      server.sendContent((const uint8_t *)WEB_INDEX_HTML + i, n);
    }
  #else
    server.send_P(200, "text/html", PORTAL_HTML);
  #endif
}

static String jsonEscape(String s) {
  s.replace("\\", "\\\\");
  s.replace("\"", "\\\"");
  return s;
}

// ------------------------------------------------------- persistence helpers

static String parseActive(String body) {
  int i = body.indexOf("\"active\"");
  if (i < 0) return "";
  int c = body.indexOf(':', i);
  int q1 = body.indexOf('"', c);
  int q2 = body.indexOf('"', q1 + 1);
  if (q1 < 0 || q2 < 0) return "";
  return body.substring(q1 + 1, q2);
}

static void saveActive(const String &active) {
  if (active != "face" && active != "animation") return;
  g_active = active;
  File f = LittleFS.open(PATH_CONFIG, FILE_WRITE);
  if (f) {
    f.print("{\"active\":\""); f.print(active); f.print("\"}");
    f.close();
    Serial.printf("[config] active -> %s\n", active.c_str());
  }
}

static String loadActive() {
  String s;
  File f = LittleFS.open(PATH_CONFIG, "r");
  if (f) { s = f.readString(); f.close(); }
  String active = parseActive(s);
  return (active == "face" || active == "animation") ? active : "face";
}

// ------------------------------------------------------------- hooks ---------
// Override these to wire up your display / backlight / battery hardware.

static int16_t readBatteryPercent() { return g_battery; }      // TODO: read your PMIC/ADC

static void applyBrightness(uint8_t value) {                   // TODO: PWM / SPI backlight
  Serial.printf("[brightness] backlight -> %u%%\n", value);
}

static void onConfigLoaded(const String &active, uint8_t brightness) { // TODO: apply saved state
  Serial.printf("[config] boot: active=%s brightness=%u%%\n", active.c_str(), brightness);
}

static void onFaceUploaded(const char *path, size_t bytes) {   // TODO: push to display
  Serial.printf("[face] uploaded %u bytes from %s\n", (unsigned)bytes, path);
  Serial.println("[face] open the file in chunks and draw RGB565 to your display");
}

static void onLiveFrame(const char *path, size_t bytes) {      // TODO: flash to display
  Serial.printf("[frame] live test: %u bytes from %s\n", (unsigned)bytes, path);
  Serial.println("[frame] open the file and draw RGB565 to your display immediately");
}

static void onAnimationUploaded(const char *path, size_t bytes) { // TODO: play frames
  Serial.printf("[anim] uploaded %u bytes from %s\n", (unsigned)bytes, path);
  File f = LittleFS.open(path, "r");
  if (f && f.size() >= ANIM_HEADER) {
    uint8_t hdr[ANIM_HEADER];
    f.read(hdr, ANIM_HEADER);
    uint16_t frames = (hdr[0] << 8) | hdr[1];
    uint32_t frameSize = ((uint32_t)hdr[2] << 24) | ((uint32_t)hdr[3] << 16) |
                         ((uint32_t)hdr[4] << 8) | hdr[5];
    Serial.printf("[anim] %u frames of %u bytes each\n", frames, (unsigned)frameSize);
  }
  if (f) f.close();
}

// ------------------------------------------------------------- HTTP API -------

static void handleInfo() {
  FSInfo64 fs;
  LittleFS.info64(fs);
  String body = String("{\"name\":\"") + jsonEscape(AP_SSID) +
                "\",\"firmwareVersion\":\"1.4.0\",\"hardwareRevision\":\"Rev C\","
                "\"batteryPercent\":" + readBatteryPercent() +
                ",\"brightness\":" + g_brightness +
                ",\"totalStorageKb\":" + (fs.totalBytes / 1024) +
                ",\"usedStorageKb\":" + (fs.usedBytes / 1024) +
                ",\"faceFileBytes\":" + (unsigned long)fileSize(PATH_FACE) +
                ",\"animFileBytes\":" + (unsigned long)fileSize(PATH_ANIM) +
                ",\"maxUploadBytes\":" + (unsigned long)MAX_UPLOAD + "}";
  sendJson(body);
}

static void handleBrightness() {
  if (server.method() == HTTP_OPTIONS) { server.send(204); return; }

  int value = -1;
  String body = server.arg("plain");
  int idx = body.indexOf("\"value\"");
  if (idx < 0) idx = body.indexOf("value");
  if (idx >= 0) {
    int start = body.indexOf(':', idx);
    if (start >= 0) {
      String num;
      for (size_t i = start + 1; i < body.length(); i++) {
        char c = body[i];
        if (c >= '0' && c <= '9') num += c;
        else if (num.length() > 0) break;
      }
      if (num.length() > 0) value = num.toInt();
    }
  }
  if (value < 0) {
    // Fall back to a query param (?value=72) or form field.
    value = server.arg("value").toInt();
  }
  if (value < 0 || value > 100) { sendJsonError("value must be 0..100"); return; }

  g_brightness = (uint8_t)value;
  prefs.putUChar("brightness", g_brightness);
  applyBrightness(g_brightness);
  sendJson(String("{\"ok\":true,\"value\":") + value + "}");
}

static void handleConfig() {
  if (server.method() == HTTP_OPTIONS) { server.send(204); return; }
  if (server.method() == HTTP_GET) {
    sendJson(String("{\"ok\":true,\"active\":\"") + g_active +
             "\",\"brightness\":" + g_brightness + "}");
    return;
  }
  String body = server.arg("plain");
  String active = parseActive(body);
  if (active != "face" && active != "animation") {
    sendJsonError("active must be face or animation");
    return;
  }
  saveActive(active);
  sendJson(String("{\"ok\":true,\"active\":\"") + active +
           "\",\"brightness\":" + g_brightness + "}");
}

static void failUpload(int status, const String &why) {
  if (g_upFile) g_upFile.close();
  if (g_upOk || g_upError.length() == 0) {
    g_upError = why;
    g_upStatus = status;
  }
  g_upOk = false;
}

// Checks the finished file is a whole face/frame or a well-formed animation.
static bool validateUpload() {
  if (g_upTarget == PATH_ANIM) {
    File f = LittleFS.open(PATH_ANIM, "r");
    if (!f || f.size() < ANIM_HEADER) { if (f) f.close(); return false; }
    uint8_t hdr[ANIM_HEADER];
    f.read(hdr, ANIM_HEADER);
    f.close();
    uint16_t frames = (hdr[0] << 8) | hdr[1];
    uint32_t frameSize = ((uint32_t)hdr[2] << 24) | ((uint32_t)hdr[3] << 16) |
                         ((uint32_t)hdr[4] << 8) | hdr[5];
    return frames >= 1 && frames <= MAX_FRAMES && frameSize == FACE_BYTES &&
           g_upBytes == ANIM_HEADER + (size_t)frames * frameSize;
  }
  return g_upBytes == FACE_BYTES;
}

static void handleUpload(HTTPUpload &upload) {
  if (upload.status == UPLOAD_FILE_START) {
    if (upload.uri == "/api/animation") g_upTarget = PATH_ANIM;
    else if (upload.uri == "/api/frame") g_upTarget = PATH_FRAME;
    else g_upTarget = PATH_FACE;
    g_upBytes = 0;
    g_upOk = true;
    g_upStatus = 200;
    g_upError = "";
    if (g_upFile) g_upFile.close();

    // The old file in this slot is replaced, so its space counts as free.
    FSInfo64 fs;
    LittleFS.info64(fs);
    size_t freeBytes = (size_t)(fs.totalBytes - fs.usedBytes) + fileSize(g_upTarget.c_str());
    size_t cap = (g_upTarget == PATH_ANIM) ? (size_t)MAX_UPLOAD : (size_t)FACE_BYTES;
    // Keep a little headroom for LittleFS metadata blocks.
    size_t room = freeBytes > 16384 ? freeBytes - 16384 : (size_t)0;
    g_upLimit = min(cap, room);
    g_upSpaceBound = room < cap;

    g_upFile = LittleFS.open(g_upTarget, FILE_WRITE);
    if (!g_upFile) failUpload(500, "storage error");
  } else if (upload.status == UPLOAD_FILE_DATA) {
    if (!g_upOk) return;  // already refused — drain the rest without writing
    if (g_upBytes + upload.currentSize > g_upLimit) {
      failUpload(413, g_upSpaceBound ? "not enough storage" : "too large");
      return;
    }
    size_t written = g_upFile.write(upload.buf, upload.currentSize);
    g_upBytes += written;
    if (written != upload.currentSize) failUpload(507, "not enough storage");
  } else if (upload.status == UPLOAD_FILE_END) {
    if (g_upFile) g_upFile.close();
    if (g_upOk && !validateUpload()) failUpload(400, "invalid size");
    Serial.printf("[upload] %s: %s, %u bytes%s%s\n", g_upOk ? "complete" : "refused", g_upTarget.c_str(),
                  (unsigned)g_upBytes, g_upOk ? "" : " - ", g_upError.c_str());
    if (!g_upOk) {
      LittleFS.remove(g_upTarget);  // never leave a truncated file behind
      return;
    }
    if (g_upTarget == PATH_ANIM) {
      onAnimationUploaded(PATH_ANIM, g_upBytes);
      saveActive("animation");
    } else if (g_upTarget == PATH_FRAME) {
      onLiveFrame(PATH_FRAME, g_upBytes);
    } else {
      onFaceUploaded(PATH_FACE, g_upBytes);
      saveActive("face");
    }
  } else if (upload.status == UPLOAD_FILE_ABORTED) {
    failUpload(400, "aborted");
    LittleFS.remove(g_upTarget);
    Serial.println("[upload] aborted");
  }
}

static void handleUploadDone() {
  if (server.method() == HTTP_OPTIONS) { server.send(204); return; }
  if (!g_upOk) { sendJsonError(g_upError, g_upStatus); return; }
  sendJson(String("{\"ok\":true,\"bytes\":") + (unsigned long)g_upBytes + "}");
}

static void handleLatest(const char *path, const char *type) {
  if (!LittleFS.exists(path)) { server.send(404, "application/json", "{\"ok\":false,\"error\":\"none\"}"); return; }
  File f = LittleFS.open(path, "r");
  if (!f) { server.send(500, "application/json", "{\"ok\":false,\"error\":\"open failed\"}"); return; }
  server.sendHeader("Cache-Control", "no-cache");
  server.streamFile(f, type);
  f.close();
}

// ------------------------------------------------------------------ setup ----

void setup() {
  Serial.begin(115200);
  Serial.println("\nE36 Badge WiFi firmware starting…");

  LittleFS.begin(true);
  LittleFS.mkdir("/faces");
  LittleFS.mkdir("/anims");
  LittleFS.mkdir("/frames");

  prefs.begin("badge", false);
  g_brightness = prefs.getUChar("brightness", 70);
  applyBrightness(g_brightness);
  g_active = loadActive();
  onConfigLoaded(g_active, g_brightness);

  WiFi.mode(WIFI_AP);
  bool ok = WiFi.softAP(AP_SSID, AP_PASSWORD, AP_CHANNEL);
  if (!ok) { Serial.println("softAP failed!"); }

  Serial.printf("AP SSID: %s  IP: %s\n", AP_SSID, WiFi.softAPIP().toString().c_str());

  // DNS: answer every name with the badge IP so captive-portal probes land here.
  dnsServer.start(53, "*", WiFi.softAPIP());

  server.on("/", HTTP_GET, sendAppOrPortal);
  server.on("/index.html", HTTP_GET, sendAppOrPortal);
  // Captive portal probe URLs (iOS, Android, Windows, macOS).
  server.on("/hotspot-detect.html", HTTP_GET, sendAppOrPortal);
  server.on("/generate_204", HTTP_GET, sendAppOrPortal);
  server.on("/gen_204", HTTP_GET, sendAppOrPortal);
  server.on("/connecttest.txt", HTTP_GET, sendAppOrPortal);
  server.on("/ncsi.txt", HTTP_GET, sendAppOrPortal);

  server.on("/api/info", HTTP_GET, handleInfo);
  server.on("/api/info", HTTP_OPTIONS, []() { server.send(204); });
  server.on("/api/brightness", HTTP_POST, handleBrightness);
  server.on("/api/brightness", HTTP_OPTIONS, []() { server.send(204); });
  server.on("/api/face", HTTP_POST, handleUploadDone, handleUpload);
  server.on("/api/face", HTTP_OPTIONS, []() { server.send(204); });
  server.on("/api/animation", HTTP_POST, handleUploadDone, handleUpload);
  server.on("/api/animation", HTTP_OPTIONS, []() { server.send(204); });
  server.on("/api/frame", HTTP_POST, handleUploadDone, handleUpload);
  server.on("/api/frame", HTTP_OPTIONS, []() { server.send(204); });
  server.on("/api/faces/latest", HTTP_GET, []() { handleLatest(PATH_FACE, "application/octet-stream"); });
  server.on("/api/anims/latest", HTTP_GET, []() { handleLatest(PATH_ANIM, "application/octet-stream"); });
  server.on("/api/frame/latest", HTTP_GET, []() { handleLatest(PATH_FRAME, "application/octet-stream"); });
  server.on("/api/config", HTTP_GET, handleConfig);
  server.on("/api/config", HTTP_POST, handleConfig);
  server.on("/api/config", HTTP_OPTIONS, []() { server.send(204); });

  server.onNotFound([]() {
    if (server.uri().startsWith("/api/")) {
      sendJsonError("not found");
    } else {
      sendAppOrPortal();
    }
  });

  server.begin();
  Serial.println("HTTP server ready. Phones: join the WiFi network, the app opens automatically.");
}

// ------------------------------------------------------------------- loop ----

void loop() {
  dnsServer.processNextRequest();
  server.handleClient();
}
