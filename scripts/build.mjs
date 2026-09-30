import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { missionSummaries } from "../src/missions.js";
await mkdir("dist", { recursive: true });
const result = await build({
  entryPoints: ["bgs/viewer.js"],
  bundle: true,
  minify: process.env.BGS_DEBUG !== "1",
  format: "iife",
  target: ["chrome109", "firefox115", "safari15.4"],
  outfile: "dist/viewer.js",
  loader: { ".html": "text", ".css": "text" },
  define: {
    BGS_MISSIONS: JSON.stringify(
      missionSummaries.map(({ id, title }) => ({ id, title })),
    ),
  },
  metafile: true,
});
await writeFile(
  "dist/viewer-meta.json",
  JSON.stringify(result.metafile, null, 2),
);
console.log(
  `Viewer: ${readFileSync("dist/viewer.js").length} bytes; ${gzipSync(readFileSync("dist/viewer.js")).length} bytes gzip`,
);
