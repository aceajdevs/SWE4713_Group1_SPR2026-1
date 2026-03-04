export async function hashSecurityAnswer(answer) {
  const text = (answer ?? '').trim();
  const encoder = new TextEncoder();
  const data = encoder.encode(text);

  const digest = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(digest));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  return hashHex;
}

