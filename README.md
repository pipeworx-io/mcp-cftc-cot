# mcp-cftc-cot

CFTC Commitment of Traders (COT) MCP.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

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

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Cftc Cot data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
