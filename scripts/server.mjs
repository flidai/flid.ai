import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSite } from "./build.mjs";
import { parseByteRange } from "../lib/http-range.mjs";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const root = join(projectRoot, "dist");
const port = Number(process.env.PORT ?? 3000);

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".mjs": "text/javascript; charset=utf-8",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
};

function resolveRequestPath(url) {
  const pathname = decodeURIComponent(new URL(url, "http://localhost").pathname);
  const normalized = normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, "");
  const relative = normalized.replace(/^[/\\]+/, "");
  return join(root, relative || "index.html");
}

await buildSite();

const server = createServer(async (request, response) => {
  let target = resolveRequestPath(request.url ?? "/");

  try {
    const targetStat = await stat(target);
    if (targetStat.isDirectory()) {
      target = join(target, "index.html");
    }
  } catch {
    if (!extname(target)) {
      target = join(target, "index.html");
    }
  }

  if (!target.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const fileStat = await stat(target);
    if (!fileStat.isFile()) {
      throw new Error("Not a file");
    }

    const extension = extname(target);
    const range = extension === ".mp4"
      ? parseByteRange(request.headers.range, fileStat.size)
      : undefined;

    if (range === null) {
      response.writeHead(416, {
        "Content-Range": `bytes */${fileStat.size}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-store",
      });
      response.end();
      return;
    }

    if (range) {
      response.writeHead(206, {
        "Content-Type": contentTypes[extension] ?? "application/octet-stream",
        "Content-Length": range.length,
        "Content-Range": `bytes ${range.start}-${range.end}/${fileStat.size}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-store",
      });
      createReadStream(target, { start: range.start, end: range.end }).pipe(response);
      return;
    }

    response.writeHead(200, {
      "Content-Type": contentTypes[extension] ?? "application/octet-stream",
      "Content-Length": fileStat.size,
      ...(extension === ".mp4" ? { "Accept-Ranges": "bytes" } : {}),
      "Cache-Control": "no-store",
    });
    createReadStream(target).pipe(response);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Flid static site: http://localhost:${port}`);
});
