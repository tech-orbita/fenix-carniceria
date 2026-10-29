type SiteUrlOptions = {
  configured?: string;
  requestOrigin?: string | null;
  vercelProductionHost?: string;
};

function validOrigin(value?: string | null) {
  if (!value) return undefined;
  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    if (!['http:', 'https:'].includes(url.protocol)) return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

export function resolveSiteUrl({ configured, requestOrigin, vercelProductionHost }: SiteUrlOptions) {
  const configuredOrigin = validOrigin(configured);
  const productionOrigin = validOrigin(vercelProductionHost);
  const configuredIsLocal = configuredOrigin?.includes("localhost") || configuredOrigin?.includes("127.0.0.1");

  if (productionOrigin && configuredIsLocal) return productionOrigin;
  return configuredOrigin ?? productionOrigin ?? validOrigin(requestOrigin) ?? "http://localhost:3000";
}
