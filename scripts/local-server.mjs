import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve("dist");
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "127.0.0.1";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function resolveStaticPath(urlPath) {
  const cleanPath = decodeURIComponent(urlPath.split("?")[0]);
  const withoutBase = ["/TACO/", "/taco/"].find((base) => cleanPath.startsWith(base))
    ? cleanPath.replace(/^\/(?:TACO|taco)/, "")
    : cleanPath;
  const normalized = normalize(withoutBase).replace(/^(\.\.[/\\])+/, "");
  let filePath = join(root, normalized);
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = join(root, "index.html");
  }
  return filePath;
}

async function proxyLlm(req, res) {
  try {
    const { baseUrl, apiPath, apiKey, requestBody } = await readJson(req);
    if (!baseUrl || !apiPath || !apiKey || !requestBody) {
      sendJson(res, 400, { error: "Missing baseUrl, apiPath, apiKey, or requestBody." });
      return;
    }

    const endpoint = `${String(baseUrl).replace(/\/$/, "")}${String(apiPath).startsWith("/") ? apiPath : `/${apiPath}`}`;
    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });
    const body = await upstream.text();
    res.writeHead(upstream.status, {
      "Content-Type": upstream.headers.get("content-type") || "application/json; charset=utf-8",
    });
    res.end(body);
  } catch (error) {
    sendJson(res, 502, { error: error instanceof Error ? error.message : String(error) });
  }
}

const server = createServer(async (req, res) => {
  if (req.url === "/api/health") {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.url === "/api/llm-proxy" && req.method === "POST") {
    await proxyLlm(req, res);
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    sendJson(res, 405, { error: "Method not allowed." });
    return;
  }

  const filePath = resolveStaticPath(req.url || "/");
  if (!existsSync(filePath)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const type = mimeTypes[extname(filePath)] || "application/octet-stream";
  const stat = statSync(filePath);
  res.writeHead(200, {
    "Content-Type": type,
    "Content-Length": stat.size,
    "Cache-Control": "no-cache",
  });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  createReadStream(filePath).pipe(res);
});

if (!existsSync(root)) {
  console.error("dist/ does not exist. Run npm run build first, or use npm run local.");
  process.exit(1);
}

server.listen(port, host, () => {
  console.log(`TACO local web app: http://${host}:${port}/taco/`);
  console.log(`TACO local web app: http://${host}:${port}/TACO/`);
  console.log("Local LLM proxy: /api/llm-proxy");
});
