// Male Thai announcer voice via Azure AI Speech (th-TH-NiwatNeural).
// The browser sends the announcement as phrases + pause lengths; we turn that into SSML
// with exact <break> pauses and return an MP3.
const VOICE = 'th-TH-NiwatNeural';
const esc = s => String(s).replace(/[<>&'"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[c]));

export default async (req) => {
  const key = process.env.AZURE_SPEECH_KEY;
  // GET = "is the cloud male voice configured?" (no key yet -> browser voice is used instead)
  if (req.method === 'GET') return Response.json({ enabled: !!key });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const region = process.env.AZURE_SPEECH_REGION || 'southeastasia';
  if (!key) return new Response('TTS not configured', { status: 503 });

  let body;
  try { body = await req.json(); } catch { return new Response('Bad JSON', { status: 400 }); }
  const segs = Array.isArray(body.segments) ? body.segments.slice(0, 80) : [];
  if (!segs.length) return new Response('No text', { status: 400 });

  const inner = segs.map(s => {
    const t = esc(String(s.t || '').slice(0, 200));
    const gap = Math.max(0, Math.min(3000, Number(s.gap) || 0));
    return t + (gap ? `<break time="${gap}ms"/>` : '');
  }).join(' ');
  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="th-TH">` +
    `<voice name="${VOICE}"><prosody rate="-8%">${inner}</prosody></voice></speak>`;

  const r = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-96kbitrate-mono-mp3',
      'User-Agent': 'badminton-announcer',
    },
    body: ssml,
  });
  if (!r.ok) return new Response('TTS failed: ' + r.status, { status: 502 });
  return new Response(r.body, { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' } });
};

export const config = { path: '/api/tts' };
