// Only filenames are bundled. Capture the entry URL while the classic BGS
// script is executing; neither the host page nor its <base> owns our assets.
const sourceFiles = { en: "locales/en.json", fr: "locales/fr.json" };
const files = typeof BGS_LOCALES === "undefined" ? sourceFiles : BGS_LOCALES;
const assetBase = new URL(".", import.meta.url);

export function normalizeLocale(value = "en", available = Object.keys(files)) {
  const tag = String(value).replaceAll("_", "-").toLowerCase();
  return (
    available.find((locale) => locale.toLowerCase() === tag) ??
    available.find((locale) => locale.toLowerCase() === tag.split("-")[0]) ??
    "en"
  );
}

async function readCatalog(url) {
  // The same catalogs are used by Node's deterministic tutorial tests.
  if (url.protocol === "file:")
    return (await import(url.href, { with: { type: "json" } })).default;
  const response = await fetch(url);
  if (!response.ok) throw Error(`Language file: HTTP ${response.status}`);
  return response.json();
}

export function createLocaleLoader(manifest, base, read = readCatalog) {
  const catalogs = new Map(),
    pending = new Map();
  const normalize = (value) => normalizeLocale(value, Object.keys(manifest));
  async function load(value) {
    const locale = normalize(value);
    if (catalogs.has(locale)) return locale;
    if (!pending.has(locale)) {
      pending.set(
        locale,
        Promise.resolve()
          .then(() => read(new URL(manifest[locale], base)))
          .then((catalog) => {
            if (
              !catalog ||
              typeof catalog !== "object" ||
              Array.isArray(catalog) ||
              Object.values(catalog).some((text) => typeof text !== "string")
            )
              throw Error("Invalid language file");
            catalogs.set(locale, catalog);
            return locale;
          })
          .finally(() => pending.delete(locale)),
      );
    }
    try {
      return await pending.get(locale);
    } catch (error) {
      // A failed request is not cached: selecting that language again retries.
      if (locale !== "en") return load("en");
      throw error;
    }
  }
  function translate(locale, key, params = {}) {
    const text =
      catalogs.get(normalize(locale))?.[key] ?? catalogs.get("en")?.[key];
    if (text === undefined) throw Error(`Missing loaded translation: ${key}`);
    return text.replace(/\{(\w+)\}/g, (match, name) =>
      params[name] === undefined ? match : String(params[name]),
    );
  }
  return {
    load,
    translate,
    has: (locale, key) =>
      Object.hasOwn(catalogs.get(normalize(locale)) ?? {}, key),
  };
}

const loader = createLocaleLoader(files, assetBase);
export const loadLocale = loader.load;
export const translate = loader.translate;

// Live BGS preference updates may race network requests. Only the last request
// is allowed to change the visible language; destruction also invalidates it.
export function createLocaleSelection(apply, load = loadLocale) {
  let revision = 0;
  return {
    async set(value) {
      const attempt = ++revision;
      const locale = await load(value);
      if (attempt !== revision) return false;
      apply(locale);
      return true;
    },
    destroy() {
      revision++;
    },
  };
}

export function lessonCopy(id, locale) {
  const prefix = `lesson.${id}`;
  const instructions = [];
  for (let i = 0; loader.has(locale, `${prefix}.instruction.${i}`); i++)
    instructions.push(translate(locale, `${prefix}.instruction.${i}`));
  return { title: translate(locale, `${prefix}.title`), instructions };
}
