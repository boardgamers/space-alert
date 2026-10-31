import { mountLesson } from "../bgs/tutorial.js";
const query = new URL(location.href).searchParams;
mountLesson(document.body, {
  chapter: query.get("chapter") ?? "basics",
  locale: query.get("locale") ?? "en",
  standalone: true,
}).catch((error) => {
  document.body.textContent = error.message;
});
