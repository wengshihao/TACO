// Captures docs/playground.png: a finished TACO run in the web playground.
//
//   npm run build
//   TACO_API_KEY=... TACO_BASE_URL=... TACO_MODEL=... node scripts/capture-playground.mjs
//
// The run goes through the local proxy, so any OpenAI-compatible endpoint works.
// Set CHROME to a Chrome/Chromium binary if it is not in the default macOS location.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const chromePath = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const apiKey = process.env.TACO_API_KEY;
const baseUrl = process.env.TACO_BASE_URL || "https://api.openai.com/v1";
const model = process.env.TACO_MODEL || "gpt-4o-mini";
const output = process.env.OUTPUT || "docs/playground.png";
const appPort = 4179;
const debugPort = 9339;

if (!apiKey) {
  console.error("Set TACO_API_KEY (and optionally TACO_BASE_URL, TACO_MODEL).");
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const server = spawn(process.execPath, ["scripts/local-server.mjs"], { env: { ...process.env, PORT: String(appPort) }, stdio: "ignore" });
const profile = mkdtempSync(join(tmpdir(), "taco-capture-"));
const chrome = spawn(chromePath, ["--headless=new", `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, "--hide-scrollbars", "about:blank"], {
  stdio: "ignore",
});

async function connect() {
  for (let i = 0; i < 50; i += 1) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
      const page = targets.find((target) => target.type === "page");
      if (page) return new WebSocket(page.webSocketDebuggerUrl);
    } catch {
      // Chrome is still starting.
    }
    await sleep(200);
  }
  throw new Error("Could not connect to Chrome.");
}

const socket = await connect();
await new Promise((resolve) => socket.addEventListener("open", resolve, { once: true }));
let nextId = 0;
const pending = new Map();
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  }
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression) => {
  const { result, exceptionDetails } = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
  return result.value;
};

try {
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1100, deviceScaleFactor: 2, mobile: false });
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });
  const url = `http://127.0.0.1:${appPort}/TACO/`;
  await send("Page.navigate", { url });
  await sleep(1500);
  await evaluate(`
    localStorage.setItem("taco:config", JSON.stringify({
      baseUrl: ${JSON.stringify(baseUrl)}, apiPath: "/chat/completions", model: ${JSON.stringify(model)},
      temperature: 0, maxTokens: 4096, useLocalProxy: true, maxRecompletion: 2,
    }));
    sessionStorage.setItem("taco:key", ${JSON.stringify(apiKey)});
    localStorage.setItem("taco:theme", "light");
  `);
  await send("Page.navigate", { url });
  await sleep(2500);
  const done = await evaluate(`(async () => {
    document.documentElement.style.scrollBehavior = "auto";
    document.querySelector(".run").click();
    for (let i = 0; i < 1200; i += 1) {
      if (document.querySelector(".verdict-word")) return "ok";
      const error = document.querySelector(".error-box");
      if (error) return error.innerText;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return "timed out";
  })()`);
  if (done !== "ok") throw new Error(`Run did not finish: ${done}`);
  await sleep(600);
  const box = await evaluate(`(() => {
    const rect = document.querySelector(".playground").getBoundingClientRect();
    return { x: rect.left + scrollX, y: rect.top + scrollY, width: rect.width, height: rect.height };
  })()`);
  const pad = 28;
  const { data } = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
    clip: { x: box.x - pad, y: box.y - pad, width: box.width + pad * 2, height: box.height + pad * 2, scale: 1 },
  });
  writeFileSync(output, Buffer.from(data, "base64"));
  console.log(`Wrote ${output}`);
} finally {
  socket.close();
  chrome.kill();
  server.kill();
  await sleep(300);
  rmSync(profile, { recursive: true, force: true });
}
