import Anthropic from '@anthropic-ai/sdk';
import type { Request, Response } from 'express';

/**
 * The only thing in this project that talks to the Anthropic API, and the only
 * thing that holds the API key.
 *
 * Several people use this app from their own phones and none of them have an
 * Anthropic key, so the key lives server-side and the browser never sees it.
 * That makes this endpoint public by URL, so it is guarded by a shared access
 * code, a per-IP rate limit and a request size cap.
 *
 * Nothing is logged or persisted. The image is held in memory for the length of
 * one request and then discarded — no storage, no analytics, no request bodies
 * in the logs.
 *
 * The secrets arrive as an argument rather than being read from the environment
 * here, so this file has no ambient dependency on how it was deployed and can
 * be exercised directly in a test.
 */

export interface HandlerSecrets {
  apiKey: string;
  accessCode: string;
}

/** Reject anything larger than this, measured on the base64 payload. */
const MAX_IMAGE_BASE64_BYTES = 2 * 1024 * 1024;
const RATE_LIMIT_PER_HOUR = 20;
const RATE_WINDOW_MS = 60 * 60 * 1000;

/** Receipts run to maybe 40 lines; 4k leaves generous headroom for the JSON. */
const MAX_TOKENS = 4096;

const MODEL = 'claude-sonnet-5';

const ACCEPTED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
type MediaType = (typeof ACCEPTED_MEDIA_TYPES)[number];

/**
 * Best-effort per-IP rate limiting.
 *
 * This is an in-memory counter in a stateless, horizontally-scaled function:
 * it resets on cold start and one instance cannot see its siblings, so it
 * bounds a single instance's traffic rather than a caller's true rate. It
 * raises the cost of casual abuse; the access code is what actually keeps
 * strangers out. Swap this map for a shared store — Firestore is already in the
 * project — if a real limit is ever needed. `hitRateLimit` is the only thing
 * that would change.
 */
const requestLog = new Map<string, number[]>();

function hitRateLimit(ip: string): boolean {
  const now = Date.now();
  const recent = (requestLog.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);

  if (recent.length >= RATE_LIMIT_PER_HOUR) {
    requestLog.set(ip, recent);
    return true;
  }

  recent.push(now);
  requestLog.set(ip, recent);

  // Opportunistic cleanup so a long-lived instance doesn't grow unbounded.
  if (requestLog.size > 5000) {
    for (const [key, times] of requestLog) {
      if (times.every((t) => now - t >= RATE_WINDOW_MS)) requestLog.delete(key);
    }
  }

  return false;
}

/** Constant-time comparison so the access code can't be probed byte by byte. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * The caller's address as seen through Hosting's CDN and Cloud Run, both of
 * which append to `x-forwarded-for`. The first entry is the original client.
 */
function clientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return (raw?.split(',')[0] ?? req.socket?.remoteAddress ?? 'unknown').trim();
}

const SYSTEM_PROMPT = `You read photographs of restaurant receipts and return their contents as data.

Receipts come from restaurants across Europe and are most often in Italian, Spanish, German, French or English. Layouts vary widely: thermal printer output, handwritten additions, faded ink, columns that do not line up. Do not assume any particular language or layout.

Reading the lines:
- Transcribe each line item's description as printed, keeping the original language. Do not translate, expand abbreviations, or tidy up spelling.
- A leading count such as "2 X SPRITZ APEROL" or "3 BIBITE" means quantity 2 and 3. Put the count in quantity and the printed amount for the whole line in lineTotal.
- lineTotal is the amount printed at the end of the line — the total for that line, not the price of one unit. Set unitPrice only when a per-unit price is separately printed.
- Amounts are decimal numbers in major units: write 14.00, never 1400 or "14,00".
- Skip subtotals, running totals, payment lines, change, loyalty points and VAT breakdown tables. Only real consumption belongs in items.

Totals and extras:
- tax is the VAT or sales tax as a single amount. serviceCharge is a service or "servizio" line. tip is a tip printed on the receipt. Cover charge (coperto, couvert, Gedeck) belongs in serviceCharge only if no separate line exists — otherwise put it in serviceCharge as printed.
- total is the final amount due as printed.
- currency is the ISO 4217 code implied by the receipt: EUR for €, CHF for Swiss francs, GBP for £.

Use null for anything not printed or not legible. Never invent a value to make the arithmetic work: if the lines do not add up to the printed total, return what is printed and let the human reconcile it.`;

/**
 * Structured outputs constrain the response to this shape, so the model cannot
 * return prose or markdown fences. The client still parses defensively — a
 * schema is a guarantee about this API, not about every future one.
 */
const nullable = (type: string) => ({ anyOf: [{ type }, { type: 'null' }] });

const RECEIPT_SCHEMA = {
  type: 'object',
  properties: {
    merchant: nullable('string'),
    date: {
      anyOf: [{ type: 'string', description: 'ISO 8601 date, yyyy-mm-dd' }, { type: 'null' }],
    },
    currency: nullable('string'),
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          quantity: { type: 'integer' },
          unitPrice: nullable('number'),
          lineTotal: nullable('number'),
        },
        required: ['name', 'quantity', 'unitPrice', 'lineTotal'],
        additionalProperties: false,
      },
    },
    subtotal: nullable('number'),
    tax: nullable('number'),
    tip: nullable('number'),
    serviceCharge: nullable('number'),
    total: nullable('number'),
  },
  required: [
    'merchant',
    'date',
    'currency',
    'items',
    'subtotal',
    'tax',
    'tip',
    'serviceCharge',
    'total',
  ],
  additionalProperties: false,
} as const;

interface ErrorBody {
  error: string;
  code:
    | 'bad_request'
    | 'bad_code'
    | 'rate_limited'
    | 'too_large'
    | 'unreadable'
    | 'upstream'
    | 'misconfigured';
}

function fail(res: Response, status: number, body: ErrorBody) {
  res.status(status).json(body);
}

export async function handleParseReceipt(
  req: Request,
  res: Response,
  { apiKey, accessCode }: HandlerSecrets,
): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return fail(res, 405, { error: 'Method not allowed', code: 'bad_request' });
  }

  if (!apiKey || !accessCode) {
    // Deployment problem, not a caller problem — say so without detail.
    console.error('parse-receipt: ANTHROPIC_API_KEY or ACCESS_CODE is not set');
    return fail(res, 503, { error: 'Service not configured', code: 'misconfigured' });
  }

  const provided = req.headers['x-access-code'];
  const providedCode = Array.isArray(provided) ? provided[0] : provided;
  if (!providedCode || !safeEqual(providedCode, accessCode)) {
    return fail(res, 401, { error: 'Invalid access code', code: 'bad_code' });
  }

  if (hitRateLimit(clientIp(req))) {
    res.setHeader('Retry-After', '3600');
    return fail(res, 429, { error: 'Hourly limit reached', code: 'rate_limited' });
  }

  const body = req.body as { image?: unknown; mediaType?: unknown } | undefined;
  const image = typeof body?.image === 'string' ? body.image : null;
  const mediaType = typeof body?.mediaType === 'string' ? body.mediaType : 'image/jpeg';

  if (!image) {
    return fail(res, 400, { error: 'Missing image', code: 'bad_request' });
  }
  if (!ACCEPTED_MEDIA_TYPES.includes(mediaType as MediaType)) {
    return fail(res, 400, { error: 'Unsupported image type', code: 'bad_request' });
  }
  if (image.length > MAX_IMAGE_BASE64_BYTES) {
    return fail(res, 413, { error: 'Image too large', code: 'too_large' });
  }

  const client = new Anthropic({ apiKey });

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      // Receipt transcription is a scoped extraction task: reasoning about it
      // costs latency and tokens on every photo without reading the paper any
      // better. The human reviews every line on the next screen regardless.
      thinking: { type: 'disabled' },
      output_config: { format: { type: 'json_schema', schema: RECEIPT_SCHEMA } },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType as MediaType, data: image },
            },
            { type: 'text', text: 'Read this receipt.' },
          ],
        },
      ],
    });

    if (message.stop_reason === 'refusal') {
      return fail(res, 422, { error: 'Could not read this image', code: 'unreadable' });
    }
    if (message.stop_reason === 'max_tokens') {
      return fail(res, 422, { error: 'Receipt too long to read', code: 'unreadable' });
    }

    const text = message.content.find((block) => block.type === 'text');
    if (!text || text.type !== 'text') {
      return fail(res, 422, { error: 'Empty response', code: 'unreadable' });
    }

    // Forward the model's JSON verbatim. Validation is the client's job, so
    // there is exactly one schema check in the system rather than two that can
    // disagree — and nothing here needs to understand the receipt.
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(text.text);
    return;
  } catch (error) {
    // Log the failure shape only. Never the request body, never the image.
    if (error instanceof Anthropic.RateLimitError) {
      console.error('parse-receipt: upstream rate limit');
      res.setHeader('Retry-After', '60');
      return fail(res, 429, { error: 'Busy, try again shortly', code: 'rate_limited' });
    }
    if (error instanceof Anthropic.AuthenticationError) {
      console.error('parse-receipt: ANTHROPIC_API_KEY rejected');
      return fail(res, 503, { error: 'Service not configured', code: 'misconfigured' });
    }
    if (error instanceof Anthropic.BadRequestError) {
      console.error('parse-receipt: request rejected upstream');
      return fail(res, 422, { error: 'Could not read this image', code: 'unreadable' });
    }
    console.error(
      'parse-receipt: upstream failure',
      error instanceof Anthropic.APIError ? error.status : 'unknown',
    );
    return fail(res, 502, { error: 'Reading service unavailable', code: 'upstream' });
  }
}
