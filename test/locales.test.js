import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  createLocaleLoader,
  createLocaleSelection,
  loadLocale,
  translate,
  normalizeLocale,
} from "../preview/i18n.js";

test("catalogs have matching messages/placeholders; chapter metadata is localized without duplicate subtitles", async () => {
  const read = (name) =>
    readFile(
      new URL(`../preview/locales/${name}.json`, import.meta.url),
      "utf8",
    ).then(JSON.parse);
  const en = await read("en"),
    fr = await read("fr");
  const params = (text) =>
    [...text.matchAll(/\{\w+\}/g)].map((m) => m[0]).sort();
  for (const file of await readdir(
    new URL("../preview/locales", import.meta.url),
  )) {
    const catalog = await read(file.slice(0, -5));
    assert.deepEqual(Object.keys(catalog).sort(), Object.keys(en).sort());
    for (const [key, value] of Object.entries(catalog)) {
      assert.ok(value.trim(), key);
      assert.deepEqual(params(value), params(en[key]), key);
    }
  }
  const info = JSON.parse(
    await readFile(new URL("../bgs/gameinfo.json", import.meta.url)),
  );
  for (const chapter of info.version.tutorial.chapters) {
    assert.equal(chapter.title, en[`lesson.${chapter.id}.title`]);
    assert.equal(chapter.description, "");
    const metadata =
      info.metadata.optionTranslations.fr[
        `tutorial.chapters.${chapter.id}.title`
      ];
    assert.equal(metadata.label, fr[`lesson.${chapter.id}.title`]);
    assert.equal(
      metadata.translatedFrom.hash,
      createHash("sha256").update(chapter.title).digest("hex").slice(0, 16),
    );
  }
});

test("loads only the selected catalog, caches it, resolves regional tags, and falls back/retries on failure", async () => {
  const calls = [];
  let failFrench = false;
  const loader = createLocaleLoader(
    { en: "locales/en.hash.json", fr: "locales/fr.hash.json" },
    "https://assets.example/bundle/viewer.js",
    async (url) => {
      calls.push(url.href);
      if (failFrench && url.pathname.includes("/fr.")) throw Error("offline");
      return {
        hello: url.pathname.includes("/fr.")
          ? "Bonjour {name}"
          : "Hello {name}",
      };
    },
  );
  assert.equal(await loader.load("fr_CA"), "fr");
  assert.deepEqual(calls, [
    "https://assets.example/bundle/locales/fr.hash.json",
  ]);
  await Promise.all([loader.load("fr"), loader.load("fr-FR")]);
  assert.equal(calls.length, 1);
  assert.equal(loader.translate("fr", "hello", { name: "Ada" }), "Bonjour Ada");
  assert.equal(await loader.load("de"), "en");
  assert.equal(calls.length, 2);
  const retry = createLocaleLoader(
    { en: "en", fr: "fr.json" },
    "https://assets.example/",
    async (url) => {
      if (failFrench && url.pathname.startsWith("/fr")) throw Error("offline");
      return { hello: "ok" };
    },
  );
  failFrench = true;
  assert.equal(await retry.load("fr"), "en");
  failFrench = false;
  assert.equal(await retry.load("fr"), "fr");
  assert.equal(normalizeLocale("FR-ca"), "fr");
  assert.equal(normalizeLocale("pt-BR"), "en");
  assert.equal(normalizeLocale("pt_BR", ["en", "pt-BR"]), "pt-BR");
});

test("late language requests and destroyed viewers cannot override newer preferences", async () => {
  const pending = {},
    applied = [];
  const selector = createLocaleSelection(
    (locale) => applied.push(locale),
    (locale) => new Promise((resolve) => (pending[locale] = resolve)),
  );
  const french = selector.set("fr"),
    english = selector.set("en");
  pending.en("en");
  assert.equal(await english, true);
  pending.fr("fr");
  assert.equal(await french, false);
  const late = selector.set("fr");
  selector.destroy();
  pending.fr("fr");
  assert.equal(await late, false);
  assert.deepEqual(applied, ["en"]);
});

test("all tutorial copies load in both languages and unsupported locales use English", async () => {
  const { createLessonTutorial } = await import(
    "../src/tutorial-controller.js"
  );
  const { LESSONS } = await import("../src/tutorials.js");
  for (const language of ["fr-CA", "en-GB", "de"]) {
    const locale = await loadLocale(language);
    for (const lesson of LESSONS) {
      const tutorial = await createLessonTutorial(lesson.id, {
        locale: language,
      });
      assert.equal(tutorial.snapshot.title, translate(locale, lesson.title));
      assert.ok(tutorial.snapshot.text.length);
      await tutorial.continue();
      assert.ok(tutorial.snapshot.text.length);
      tutorial.destroy();
    }
  }
});
