import { mountConsole } from "./app.js";
import { loadLocale } from "./i18n.js";
document.body.lang = await loadLocale(
  new URL(location.href).searchParams.get("locale") ?? "en",
);
mountConsole(document.body);
