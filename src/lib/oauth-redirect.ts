import { NextRequest, NextResponse } from 'next/server';

/**
 * Smart redirect for OAuth callbacks.
 * 
 * - Web: standard HTTP redirect
 * - Native (Capacitor): returns an HTML page that auto-closes the
 *   SFSafariViewController and shows a "Verbonden" message
 * 
 * Detection: checks for `paywatch-native=1` cookie set by
 * gmail-settings.tsx before opening Browser.open()
 */
export function oauthRedirect(req: NextRequest, url: string): NextResponse {
  const isNative = req.cookies.get('paywatch-native')?.value === '1';

  if (!isNative) {
    return NextResponse.redirect(url);
  }

  // Parse status from the redirect URL
  const parsed = new URL(url);
  const status = parsed.searchParams.get('status') || '';
  const isSuccess = status === 'connected';

  const title = isSuccess ? 'Verbonden!' : 'Er ging iets mis';
  const message = isSuccess
    ? 'Je e-mail is gekoppeld. Je kunt dit venster sluiten en teruggaan naar PayWatch.'
    : 'Er ging iets mis bij het verbinden. Sluit dit venster en probeer het opnieuw.';
  const emoji = isSuccess ? '✅' : '❌';

  const html = `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f7f8fa;
      color: #0A2540;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
    }
    .card {
      background: white;
      border-radius: 16px;
      padding: 40px 32px;
      text-align: center;
      box-shadow: 0 2px 12px rgba(0,0,0,0.08);
      max-width: 340px;
    }
    .emoji { font-size: 48px; margin-bottom: 16px; }
    h1 { font-size: 22px; font-weight: 700; margin-bottom: 8px; }
    p { font-size: 14px; color: #6b7280; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="emoji">${emoji}</div>
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
  <script>
    // Clear the native cookie
    document.cookie = 'paywatch-native=;path=/;max-age=0';
    // Try to close SFSafariViewController (works when opened via Capacitor Browser plugin)
    try { window.close(); } catch(e) {}
  </script>
</body>
</html>`;

  // Clear the native cookie in the response
  const response = new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Set-Cookie': 'paywatch-native=; Path=/; Max-Age=0',
    },
  });

  return response;
}
