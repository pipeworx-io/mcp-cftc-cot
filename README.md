# mcp-cftc-cot

CFTC Commitment of Traders (COT) MCP.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1683+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `search_markets` | Find CFTC Commitment of Traders (COT) futures markets by name. Use this first to get the exact market_and_exchange_names and contract_code that latest_report and report_history require. Keyless. e.g. "crude oil", "gold", "E-MINI S&P", "bitcoin", "euro", "corn". |
| `latest_report` | Most recent weekly COT positioning for one futures market. Pass the exact market_and_exchange_names from search_markets, e.g. "CRUDE OIL, LIGHT SWEET-WTI - NEW YORK MERCANTILE EXCHANGE" or "GOLD - COMMODITY EXCHANGE INC.". Returns open interest plus long/short/net for non-commercial (≈ speculators: managed money / large traders), commercial (≈ hedgers / producers), and non-reportable (small traders), with this week's changes. Keyless. |
| `report_history` | Weekly net-position time series for one futures market (non-commercial net, commercial net, open interest), most recent first. Pass the exact market_and_exchange_names from search_markets. Useful for trend / sentiment shifts over time. Keyless. |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "cftc-cot": {
      "url": "https://gateway.pipeworx.io/cftc-cot/mcp"
    }
  }
}
```

### What this endpoint actually serves

`tools/list` at `https://gateway.pipeworx.io/cftc-cot/mcp` returns the tools in the table
above **plus the shared Pipeworx meta-tools** — `ask_pipeworx`,
`discover_tools`, `search_within`, `remember`/`recall` and the rest of the
gateway-wide set. So the tool count you see is larger than this table: a
single-pack endpoint currently lists roughly 30 shared tools alongside the
pack's own. The connection's `initialize` response states its exact scope, and
is the authoritative answer for a given day.

This is deliberate, not multiplexing by accident. The meta-tools are what let a
scoped connection answer a question this pack does not cover — via
`ask_pipeworx`, which routes across the whole catalog — without you adding a
second MCP server. There is currently no way to mount a pack endpoint without
them; if the extra schemas cost you more context than the routing is worth,
connect to the full gateway once rather than to several pack endpoints.

Or connect to the full Pipeworx gateway to get every pack's tools listed
directly, instead of just this one's:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

Both URLs reach the same gateway and the same 1683+ data sources. The
only difference is which pack's tools are listed **directly**; `ask_pipeworx`
reaches all of them from either one.

## No MCP client? Call it over HTTP

```bash
curl -X POST https://gateway.pipeworx.io/v1/tools/cftc_cot_search_markets \
  -H 'Content-Type: application/json' \
  -d '{"query":"crude oil"}'
```

No account needed for the first calls. Inspect any tool: `GET https://gateway.pipeworx.io/v1/tools/cftc_cot_search_markets`. Find one: `POST https://gateway.pipeworx.io/v1/tools/search_packs` with `{"query":"..."}`.

## Standalone (no gateway account)

This package also runs as a local stdio MCP server — no Pipeworx account, no
gateway round-trip:

```json
{
  "mcpServers": {
    "cftc-cot": {
      "command": "npx",
      "args": ["-y", "@pipeworx/mcp-cftc-cot"]
    }
  }
}
```

Or run it directly to confirm it starts:

```bash
npx -y @pipeworx/mcp-cftc-cot
```

It speaks MCP over stdin/stdout and answers `initialize`/`tools/list`/`tools/call`
for **only** this pack's tools — none of the shared meta-tools the gateway
connection above adds. Same source, same tools, no ask_pipeworx routing.

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English —
this works on the pack endpoint above as well as on the full gateway:

```
ask_pipeworx({ question: "your question about Cftc Cot data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
