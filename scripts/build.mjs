import { build } from "esbuild";
import { mkdir, writeFile, readFile, readdir, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { missionSummaries } from "../src/missions.js";
await mkdir("dist", { recursive: true });
await rm("dist/locales", { recursive: true, force: true });
await mkdir("dist/locales", { recursive: true });
const locales = {};
const source = JSON.parse(await readFile("preview/locales/en.json", "utf8"));
const placeholders = (text) =>
  [...text.matchAll(/\{\w+\}/g)]
    .map((match) => match[0])
    .sort()
    .join();
for (const file of (await readdir("preview/locales")).filter((file) =>
  file.endsWith(".json"),
)) {
  const catalog = JSON.parse(await readFile(`preview/locales/${file}`, "utf8"));
  if (Object.keys(catalog).sort().join() !== Object.keys(source).sort().join())
    throw Error(`${file}: translation keys differ from English`);
  for (const [key, value] of Object.entries(catalog)) {
    if (
      typeof value !== "string" ||
      !value.trim() ||
      placeholders(value) !== placeholders(source[key])
    )
      throw Error(`${file}: invalid translation or placeholders in ${key}`);
  }
  const content = JSON.stringify(catalog);
  const hash = createHash("sha256").update(content).digest("hex").slice(0, 12);
  const locale = file.slice(0, -5);
  locales[locale] = `locales/${locale}.${hash}.json`;
  await writeFile(`dist/${locales[locale]}`, content);
}
const result = await build({
  entryPoints: ["bgs/viewer.js"],
  bundle: true,
  minify: process.env.BGS_DEBUG !== "1",
  format: "iife",
  target: ["chrome109", "firefox115", "safari15.4"],
  outfile: "dist/viewer.js",
  loader: { ".html": "text", ".css": "text" },
  define: {
    "import.meta.url": "document.currentScript.src",
    BGS_LOCALES: JSON.stringify(locales),
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
