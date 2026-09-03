import { disableTool } from "eve/tools";
import { defaultWebSearch } from "eve/tools/web_search";

// The graph is the dataset this workshop is about, so the framework's built-in
// web_search is off unless WEB_SEARCH=on. Instructions alone did not hold: the
// model kept answering company questions from the web instead of search_news.
const enabled = process.env.WEB_SEARCH?.trim().toLowerCase() === "on";

export default enabled ? defaultWebSearch : disableTool();
