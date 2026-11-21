#!/usr/bin/env node
/**
 * verify-image-model.js — deterministic probe for LibreChat's DALL-E 3 tool.
 *
 * Runs INSIDE the librechat container and exercises the mounted patch the same
 * way the Drawing Studio agent does (isAgent: true), so a red result here
 * means the kid-facing image tool is broken.
 *
 * Host usage:
 *   docker exec -i -w /app librechat node - < /home/services/KidAI/scripts/verify-image-model.js
 *
 * Exit code 0 = the tool returned a real image. 1 = the tool is still failing.
 */
const ma = require('module-alias');
ma.addAlias('~', '/app/api');

const { candidateModels } = require('/app/api/app/clients/tools/structured/imageModel.js');
const DALLE3 = require('/app/api/app/clients/tools/structured/DALLE3.js');

(async () => {
  const models = candidateModels(process.env);
  console.log('CANDIDATE_MODELS:', models.join(','));
  console.log('PRIMARY_MODEL:', models[0]);

  const tool = new DALLE3({ isAgent: true, userId: 'verify-probe' });
  const out = await tool._call({
    prompt: 'a red apple on a plain white background',
    size: '1024x1024',
    quality: 'low',
  });
  const raw = JSON.stringify(out);
  const hasImage = raw.includes('data:image/png;base64,');
  const hasError = raw.includes('Something went wrong');
  console.log('HAS_DATA_URL:', hasImage);
  console.log('HAS_ERROR_TEXT:', hasError);
  console.log('SNIPPET:', raw.slice(0, 200));
  process.exit(hasImage && !hasError ? 0 : 1);
})().catch((e) => {
  console.log('PROBE_ERROR:', e && e.message);
  process.exit(2);
});
