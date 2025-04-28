# Semantic Search MCP Server

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/mhart/mcp-semantic-search)

An MCP Server using the [Agents SDK](https://developers.cloudflare.com/agents/guides/remote-mcp-server/) that can search documentation stored
in a [Vectorize](https://developers.cloudflare.com/vectorize/) database.

The same code that powers the MCP Server at https://mcp.developers.cloudflare.com/sse

## Testing in Cloudflare's AI Playground

Go to https://playground.ai.cloudflare.com/ and enter https://mcp.developers.cloudflare.com/sse as the MCP Server

## Testing in VSCode

Type Shift-Cmd-P and choose "MCP: Add Server..." and then choose "HTTP (server-sent events)", then enter https://mcp.developers.cloudflare.com/sse as the URL.

## Testing locally (requires a populated Vectorize DB)

```sh
npm run dev
```

Then go to https://playground.ai.cloudflare.com/ and enter http://localhost:8787/sse as the MCP Server
