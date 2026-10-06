// The SDK always sends `threshold` on search_messages, but the hosted REST API
// now rejects it with 400 "unknown field: threshold". Strip it for every client,
// including the ones nams-ai-provider builds internally. The agent applies the
// same fix in agent/lib/nams.ts; import this first in standalone scripts.
import { RestTransport } from "@neo4j-labs/agent-memory";

const restRequest = RestTransport.prototype.request;
RestTransport.prototype.request = function (method, params) {
  if (method === "search_messages" && params && "threshold" in params) {
    const { threshold: _threshold, ...rest } = params;
    return restRequest.call(this, method, rest);
  }
  return restRequest.call(this, method, params);
};
