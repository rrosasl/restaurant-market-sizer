import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { handleParseReceipt } from './parseReceipt';

/**
 * The receipt-reading endpoint, reached at /api/parse-receipt through the
 * Hosting rewrite in firebase.json.
 *
 * The API key and access code are Secret Manager secrets rather than plain
 * environment config: they are injected into the running instance and never
 * appear in the deployed source, the function's configuration, or the logs.
 */
const anthropicApiKey = defineSecret('ANTHROPIC_API_KEY');
const sharedAccessCode = defineSecret('ACCESS_CODE');

export const parseReceipt = onRequest(
  {
    // Hosting rewrites reach functions in us-central1 most reliably; changing
    // this means changing the region in firebase.json to match.
    region: 'us-central1',
    secrets: [anthropicApiKey, sharedAccessCode],
    // A handful of people splitting dinner needs almost nothing. The cap is
    // the real backstop on cost if the access code ever leaks.
    maxInstances: 3,
    concurrency: 20,
    memory: '512MiB',
    // Reading a receipt takes a few seconds; this is headroom, not a target.
    timeoutSeconds: 60,
    // The app is served from the same origin through the Hosting rewrite, so
    // no cross-origin access is needed or wanted.
    cors: false,
  },
  async (req, res) => {
    await handleParseReceipt(req, res, {
      apiKey: anthropicApiKey.value(),
      accessCode: sharedAccessCode.value(),
    });
  },
);
