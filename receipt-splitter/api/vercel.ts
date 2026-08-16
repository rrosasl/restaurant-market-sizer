import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Minimal typings for the Vercel Node function signature.
 *
 * The `@vercel/node` package exists for these two types, but it drags in a
 * large transitive tree (and, at the time of writing, eleven advisories) for
 * type information alone — the runtime is supplied by the platform, not by us.
 * These are the only members this project's handler touches.
 */

export interface VercelRequest extends IncomingMessage {
  /** Parsed JSON body for `application/json` requests. */
  body?: unknown;
  query: Record<string, string | string[]>;
  cookies: Record<string, string>;
}

export interface VercelResponse extends ServerResponse<IncomingMessage> {
  status(code: number): VercelResponse;
  json(body: unknown): VercelResponse;
  send(body: string): VercelResponse;
}
