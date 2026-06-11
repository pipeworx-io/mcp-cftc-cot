interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * CFTC Commitment of Traders (COT) MCP.
 *
 * Weekly U.S. futures-market positioning from the CFTC's Legacy Futures-Only
 * Commitment of Traders report, via the CFTC public Socrata API
 * (publicreporting.cftc.gov, dataset 6dca-aqww). Long/short positions split by
 * trader type: non-commercial (≈ speculators / managed money / large traders)
 * vs commercial (≈ hedgers / producers) vs non-reportable (small traders).
 * Keyless. High-signal sentiment/positioning data for the markets audience.
 */


const BASE = 'https://publicreporting.cftc.gov/resource';
const DATASET = '6dca-aqww.json'; // Legacy Futures-Only
const UA = 'pipeworx/1.0 (+https://pipeworx.io)';

/** Coerce CFTC's string-typed numeric fields to Number (null on failure). */
function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Build a Socrata query string and fetch JSON rows. params values are NOT
 *  pre-encoded — this helper URL-encodes them (including quotes in $where). */
async function cotGet(
  path: string,
  params: Record<string, string | number>,
): Promise<Array<Record<string, unknown>>> {
  const qs = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  const url = `${BASE}/${path}${qs ? `?${qs}` : ''}`;
  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA } });
  if (!res.ok) throw new Error(`CFTC: ${res.status} ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  return Array.isArray(json) ? (json as Array<Record<string, unknown>>) : [];
}

/** Strip the time component CFTC appends to report dates (ISO datetime → date). */
function reportDate(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  return v.split('T')[0];
}

const tools: McpToolExport['tools'] = [
  {
    name: 'search_markets',
    description:
      "Find CFTC Commitment of Traders (COT) futures markets by name. Use this first to get the exact market_and_exchange_names and contract_code that latest_report and report_history require. Keyless. e.g. \"crude oil\", \"gold\", \"E-MINI S&P\", \"bitcoin\", \"euro\", \"corn\".",
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Substring to match against the market name, e.g. "crude oil", "gold", "E-MINI S&P", "bitcoin", "euro".',
        },
        limit: { type: 'number', description: 'Max distinct markets to return (default 15, max 30).' },
      },
      required: ['query'],
    },
  },
  {
    name: 'latest_report',
    description:
      "Most recent weekly COT positioning for one futures market. Pass the exact market_and_exchange_names from search_markets, e.g. \"CRUDE OIL, LIGHT SWEET-WTI - NEW YORK MERCANTILE EXCHANGE\" or \"GOLD - COMMODITY EXCHANGE INC.\". Returns open interest plus long/short/net for non-commercial (≈ speculators: managed money / large traders), commercial (≈ hedgers / producers), and non-reportable (small traders), with this week's changes. Keyless.",
    inputSchema: {
      type: 'object',
      properties: {
        market_name: {
          type: 'string',
          description:
            'Exact market_and_exchange_names from search_markets, e.g. "CRUDE OIL, LIGHT SWEET-WTI - NEW YORK MERCANTILE EXCHANGE".',
        },
      },
      required: ['market_name'],
    },
  },
  {
    name: 'report_history',
    description:
      "Weekly net-position time series for one futures market (non-commercial net, commercial net, open interest), most recent first. Pass the exact market_and_exchange_names from search_markets. Useful for trend / sentiment shifts over time. Keyless.",
    inputSchema: {
      type: 'object',
      properties: {
        market_name: {
          type: 'string',
          description: 'Exact market_and_exchange_names from search_markets.',
        },
        weeks: { type: 'number', description: 'Number of weekly reports to return (default 26, max 104).' },
      },
      required: ['market_name'],
    },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  try {
    switch (name) {
      case 'search_markets':
        return searchMarkets(args);
      case 'latest_report':
        return latestReport(args);
      case 'report_history':
        return reportHistory(args);
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

async function searchMarkets(args: Record<string, unknown>): Promise<unknown> {
  const query = typeof args.query === 'string' ? args.query.trim() : '';
  if (!query) return { error: 'provide a query, e.g. "gold" or "crude oil"' };
  const limit = Math.min(Math.max(num(args.limit) ?? 15, 1), 30);

  // Escape single quotes for the SoQL string literal, then match case-insensitively.
  const safe = query.replace(/'/g, "''");
  // Pull recent rows (multiple markets per week) and dedupe by market name client-side.
  const rows = await cotGet(DATASET, {
    $where: `upper(market_and_exchange_names) like upper('%${safe}%')`,
    $order: 'report_date_as_yyyy_mm_dd DESC',
    $limit: 500,
    $select: 'market_and_exchange_names,cftc_contract_market_code',
  });

  const seen = new Set<string>();
  const markets: Array<{ market_name: unknown; contract_code: unknown }> = [];
  for (const r of rows) {
    const mn = r.market_and_exchange_names;
    if (typeof mn !== 'string' || seen.has(mn)) continue;
    seen.add(mn);
    markets.push({ market_name: mn, contract_code: r.cftc_contract_market_code });
    if (markets.length >= limit) break;
  }

  return { count: markets.length, markets };
}

async function latestReport(args: Record<string, unknown>): Promise<unknown> {
  const name = typeof args.market_name === 'string' ? args.market_name.trim() : '';
  if (!name) return { error: 'provide market_name (exact market_and_exchange_names from search_markets)' };

  const safe = name.replace(/'/g, "''");
  const rows = await cotGet(DATASET, {
    $where: `market_and_exchange_names='${safe}'`,
    $order: 'report_date_as_yyyy_mm_dd DESC',
    $limit: 1,
  });
  if (rows.length === 0) {
    return {
      error:
        'no COT market matches that exact name — use search_markets to get the exact market_and_exchange_names',
    };
  }

  const r = rows[0];
  const ncLong = num(r.noncomm_positions_long_all);
  const ncShort = num(r.noncomm_positions_short_all);
  const cLong = num(r.comm_positions_long_all);
  const cShort = num(r.comm_positions_short_all);

  return {
    market_name: r.market_and_exchange_names,
    report_date: reportDate(r.report_date_as_yyyy_mm_dd),
    open_interest: num(r.open_interest_all),
    noncommercial: {
      long: ncLong,
      short: ncShort,
      // CFTC field name has a typo upstream: noncomm_postions_spread_all.
      spread: num(r.noncomm_postions_spread_all),
      net: ncLong !== null && ncShort !== null ? ncLong - ncShort : null,
      pct_oi_long: num(r.pct_of_oi_noncomm_long_all),
    },
    commercial: {
      long: cLong,
      short: cShort,
      net: cLong !== null && cShort !== null ? cLong - cShort : null,
      pct_oi_long: num(r.pct_of_oi_comm_long_all),
    },
    nonreportable: {
      long: num(r.nonrept_positions_long_all),
      short: num(r.nonrept_positions_short_all),
    },
    weekly_change: {
      noncomm_long: num(r.change_in_noncomm_long_all),
      noncomm_short: num(r.change_in_noncomm_short_all),
      comm_long: num(r.change_in_comm_long_all),
      comm_short: num(r.change_in_comm_short_all),
      open_interest: num(r.change_in_open_interest_all),
    },
    total_traders: num(r.traders_tot_all),
  };
}

async function reportHistory(args: Record<string, unknown>): Promise<unknown> {
  const name = typeof args.market_name === 'string' ? args.market_name.trim() : '';
  if (!name) return { error: 'provide market_name (exact market_and_exchange_names from search_markets)' };
  const weeks = Math.min(Math.max(num(args.weeks) ?? 26, 1), 104);

  const safe = name.replace(/'/g, "''");
  const rows = await cotGet(DATASET, {
    $where: `market_and_exchange_names='${safe}'`,
    $order: 'report_date_as_yyyy_mm_dd DESC',
    $limit: weeks,
    $select:
      'report_date_as_yyyy_mm_dd,noncomm_positions_long_all,noncomm_positions_short_all,comm_positions_long_all,comm_positions_short_all,open_interest_all',
  });
  if (rows.length === 0) {
    return {
      error:
        'no COT market matches that exact name — use search_markets to get the exact market_and_exchange_names',
    };
  }

  const history = rows.map((r) => {
    const ncLong = num(r.noncomm_positions_long_all);
    const ncShort = num(r.noncomm_positions_short_all);
    const cLong = num(r.comm_positions_long_all);
    const cShort = num(r.comm_positions_short_all);
    return {
      date: reportDate(r.report_date_as_yyyy_mm_dd),
      noncomm_net: ncLong !== null && ncShort !== null ? ncLong - ncShort : null,
      comm_net: cLong !== null && cShort !== null ? cLong - cShort : null,
      open_interest: num(r.open_interest_all),
    };
  });

  return { market_name: name, count: history.length, history };
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
