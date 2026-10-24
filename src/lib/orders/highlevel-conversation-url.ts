const defaultAppBaseUrl = "https://app.iaorbita.com";

export function highLevelAppBaseUrl(configured = process.env.GHL_APP_BASE_URL) {
  const candidate = configured?.trim() || defaultAppBaseUrl;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" ? url.origin : defaultAppBaseUrl;
  } catch {
    return defaultAppBaseUrl;
  }
}

export function highLevelConversationUrl(locationId: string, conversationId: string, configured?: string) {
  const url = new URL(highLevelAppBaseUrl(configured));
  url.pathname = `/v2/location/${encodeURIComponent(locationId)}/conversations/conversations/${encodeURIComponent(conversationId)}`;
  url.searchParams.set("category", "team-inbox");
  url.searchParams.set("tab", "all");
  return url;
}

export function safeHighLevelConversationUrl(value: string | undefined, configured?: string) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    const allowedHost = new URL(highLevelAppBaseUrl(configured)).hostname;
    if (url.protocol !== "https:" || url.hostname !== allowedHost) return undefined;

    url.pathname = url.pathname.replace("/conversations/conversation/", "/conversations/conversations/");
    if (/\/conversations\/conversations\/[^/]+\/?$/.test(url.pathname)) {
      if (!url.searchParams.has("category")) url.searchParams.set("category", "team-inbox");
      if (!url.searchParams.has("tab")) url.searchParams.set("tab", "all");
    }
    return url;
  } catch {
    return undefined;
  }
}
