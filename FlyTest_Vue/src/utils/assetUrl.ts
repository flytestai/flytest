export function getPublicAssetUrl(assetPath: string): string {
  const normalizedPath = assetPath.replace(/^\/+/, '');
  return `${import.meta.env.BASE_URL}${normalizedPath}`;
}

const BRAND_ASSET_VERSION = '20261102-feice-navy-teal-1';

export const brandLogoUrl = `${getPublicAssetUrl('feice-mark.svg')}?v=${BRAND_ASSET_VERSION}`;
export const brandFaviconUrl = `${getPublicAssetUrl('favicon.svg')}?v=${BRAND_ASSET_VERSION}`;
export const brandWordmarkUrl = `${getPublicAssetUrl('feice-wordmark.svg')}?v=${BRAND_ASSET_VERSION}`;
export const brandFullLogoUrl = `${getPublicAssetUrl('feice-logo.svg')}?v=${BRAND_ASSET_VERSION}`;
export const brandFullLogoLoginWhiteUrl = `${getPublicAssetUrl('feice-logo-light.svg')}?v=${BRAND_ASSET_VERSION}`;
