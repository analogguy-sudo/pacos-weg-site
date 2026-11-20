// Liest den Link aus der Passwort-E-Mail. Supabase liefert je nach Vorlage
// Tokens im Fragment (#access_token=…) oder einen token_hash in der Abfrage.
const authParams = ['access_token', 'refresh_token', 'expires_in', 'expires_at', 'token_type', 'type', 'token_hash', 'error', 'error_code', 'error_description', 'provider_token', 'provider_refresh_token'];

export function parseRecoveryLink(href) {
  const url = new URL(href);
  const hash = new URLSearchParams(url.hash.slice(1));
  const read = name => hash.get(name) ?? url.searchParams.get(name);
  if (read('error')) return { invalid: true };
  if (read('type') !== 'recovery') return null;
  const accessToken = hash.get('access_token'), tokenHash = url.searchParams.get('token_hash');
  return accessToken || tokenHash ? { accessToken, tokenHash } : { invalid: true };
}

// Entfernt Tokens sofort aus Adresszeile und Verlauf.
export function cleanRecoveryUrl(href) {
  const url = new URL(href);
  for (const name of authParams) url.searchParams.delete(name);
  url.hash = '';
  return url.pathname + url.search;
}
