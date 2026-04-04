const forgeApiUrl = process.env.BUILT_IN_FORGE_API_URL;
const forgeApiKey = process.env.BUILT_IN_FORGE_API_KEY;

if (!forgeApiUrl || !forgeApiKey) {
  console.error(JSON.stringify({ error: 'missing_env', forgeApiUrl: Boolean(forgeApiUrl), forgeApiKey: Boolean(forgeApiKey) }, null, 2));
  process.exit(1);
}

const baseUrl = forgeApiUrl.endsWith('/') ? forgeApiUrl : `${forgeApiUrl}/`;
const fullUrl = new URL('v1/audio/transcriptions', baseUrl).toString();
const data = Buffer.from('QQ==', 'base64');
const formData = new FormData();
formData.append('file', new Blob([new Uint8Array(data)], { type: 'audio/webm' }), 'audio.webm');
formData.append('model', 'whisper-1');
formData.append('response_format', 'verbose_json');
formData.append('prompt', 'Transcrire fidèlement une saisie vocale de triage aux urgences.');

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 15000);

try {
  const response = await fetch(fullUrl, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${forgeApiKey}`,
      'Accept-Encoding': 'identity',
    },
    body: formData,
    signal: controller.signal,
  });

  const text = await response.text().catch(() => '');
  console.log(JSON.stringify({
    url: fullUrl,
    status: response.status,
    statusText: response.statusText,
    body: text,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    url: fullUrl,
    error: error instanceof Error ? error.message : String(error),
    name: error instanceof Error ? error.name : 'Error',
  }, null, 2));
  process.exitCode = 1;
} finally {
  clearTimeout(timeout);
}
