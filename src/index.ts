import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { queryVectorize } from "./search";

// Always return 10 results for simplicity, don't make it configurable
const TOP_K = 10;

// Define our MCP agent with tools
export class SemanticSearchMcp extends McpAgent<Env> {
  server = new McpServer({
    name: "Cloudflare Documentation Search",
    version: "1.0.0",
    description:
      "An MCP server indexed on Cloudflare's documentation at developers.cloudflare.com",
  });

  async init() {
    this.server.tool(
      "semantic_search",
      "Search Cloudflare's documentation and return semantically similar snippets",
      { query: z.string() },
      async ({ query }) => {
        const results = await queryVectorize(
          this.env.AI,
          this.env.VECTORS,
          query,
          TOP_K
        );
        const resultsAsXml = results
          .map((result) => {
            return `<result>
<url>${result.url}</url>
<text>
${result.text}
</text>
</result>`;
          })
          .join("\n");
        return {
          content: [{ type: "text", text: resultsAsXml }],
        };
      }
    );
  }
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    if (url.pathname === "/sse" || url.pathname === "/sse/message") {
      return SemanticSearchMcp.serveSSE("/sse").fetch(request, env, ctx);
    }

    if (url.pathname === "/mcp") {
      return SemanticSearchMcp.serve("/mcp").fetch(request, env, ctx);
    }

    return new Response("Not found", { status: 404 });
  },
};
