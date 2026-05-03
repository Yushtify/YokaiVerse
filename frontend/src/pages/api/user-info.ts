import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ request }) => {
  // Get user agent for device detection
  const userAgent = request.headers.get("user-agent") || "Unknown";

  // Parse device info from user agent
  const deviceInfo = parseUserAgent(userAgent);

  return new Response(
    JSON.stringify({
      device: deviceInfo.device,
      browser: deviceInfo.browser,
      browserVersion: deviceInfo.browserVersion,
      os: deviceInfo.os,
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
};

function parseUserAgent(userAgent: string) {
  // Device detection
  let device = "Desktop";
  if (/mobile|android|iphone|ipad|ipod|windows phone/i.test(userAgent)) {
    device = /ipad/i.test(userAgent) ? "Tablet" : "Mobile";
  }

  // Browser detection with version
  let browser = "Unknown Browser";
  let browserVersion = "Unknown";

  if (/edg/i.test(userAgent)) {
    browser = "Edge";
    const match = userAgent.match(/Edg[e]?\/(\d+)/i);
    if (match) browserVersion = match[1];
  } else if (/chrome/i.test(userAgent) && !/chromium/i.test(userAgent)) {
    browser = "Chrome";
    const match = userAgent.match(/Chrome\/(\d+)/i);
    if (match) browserVersion = match[1];
  } else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) {
    browser = "Safari";
    const match = userAgent.match(/Version\/(\d+)/i);
    if (match) browserVersion = match[1];
  } else if (/firefox/i.test(userAgent)) {
    browser = "Firefox";
    const match = userAgent.match(/Firefox\/(\d+)/i);
    if (match) browserVersion = match[1];
  } else if (/opera|opr/i.test(userAgent)) {
    browser = "Opera";
    const match = userAgent.match(/OPR\/(\d+)/i);
    if (match) browserVersion = match[1];
  }

  // OS detection
  let os = "Unknown OS";
  if (/windows/i.test(userAgent)) os = "Windows";
  else if (/mac|macintosh|macos/i.test(userAgent)) os = "macOS";
  else if (/linux/i.test(userAgent)) os = "Linux";
  else if (/android/i.test(userAgent)) os = "Android";
  else if (/iphone|ipad|ipod/i.test(userAgent)) os = "iOS";

  return { device, browser, browserVersion, os };
}
