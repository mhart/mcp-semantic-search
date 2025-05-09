import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { queryVectorize } from "./search";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { toFetchResponse, toReqRes } from "fetch-to-node";

// Always return 10 results for simplicity, don't make it configurable
const TOP_K = 10;

const getServer = (env: Env) => {
  const server = new McpServer(
    {
      name: "Cloudflare Documentation Search",
      version: "1.0.0",
      description:
        "An MCP server indexed on Cloudflare's documentation at developers.cloudflare.com",
    },
    { capabilities: { logging: {} } }
  );

  server.tool(
    "search_cloudflare_documentation",
    "Search Cloudflare's documentation and return semantically similar snippets",
    { query: z.string() },
    async ({ query }) => {
      const results = await queryVectorize(env.AI, env.VECTORS, query, TOP_K);
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

  // Added for extra debuggability
  server.server.onerror = console.error.bind(console);

  return server;
};

// A stateful agent using the Agents SDK
export class SemanticSearchMcp extends McpAgent<Env> {
  server = new McpServer({ name: "", version: "" }); // just a dummy value, will init below

  async init() {
    this.server = getServer(this.env);
  }
}

// A stateless handler just using the MCP SDK
async function statelessHandler(
  env: Env,
  request: Request,
  _ctx: ExecutionContext
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "content-type",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  if (request.method !== "POST") {
    return jsonRpcError(-32000, "Method not allowed.", 405);
  }

  const { req, res } = toReqRes(request);

  // Modified to add CORS header
  res.setHeader("Access-Control-Allow-Origin", "*");

  const server = getServer(env);

  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    // Added for extra debuggability
    transport.onerror = console.error.bind(console);

    await server.connect(transport);

    await transport.handleRequest(req, res, await request.json());

    return toFetchResponse(res);
  } catch (e) {
    console.error(e);
    return jsonRpcError(-32603, "Internal server error", 500);
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const { pathname } = new URL(request.url);

    // Provide an SSE endpoint for legacy clients, but if we chose not to do this we wouldn't need a DO at all
    if (pathname === "/sse" || pathname === "/sse/message") {
      return SemanticSearchMcp.serveSSE("/sse").fetch(request, env, ctx);
    }

    // We could use SemanticSearchMcp to serve this, but as it's stateless we don't need to use a DO
    if (pathname === "/mcp") {
      return statelessHandler(env, request, ctx);
    }

    return new Response("Not found", { status: 404 });
  },
};

function jsonRpcError(
  code: number,
  message: string,
  status: number,
  id: string | null = null
): Response {
  return Response.json(
    {
      jsonrpc: "2.0",
      error: {
        code,
        message,
      },
      id,
    },
    { status }
  );
}
