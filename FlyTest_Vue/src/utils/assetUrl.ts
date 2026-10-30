export function getPublicAssetUrl(assetPath: string): string {
  const normalizedPath = assetPath.replace(/^\/+/, '');
  return `${import.meta.env.BASE_URL}${normalizedPath}`;
}

const BRAND_ASSET_VERSION = '20261030-feice-a2-4';

export const brandLogoUrl = `${getPublicAssetUrl('feice-mark.svg')}?v=${BRAND_ASSET_VERSION}`;
export const brandFaviconUrl = `${getPublicAssetUrl('favicon.svg')}?v=${BRAND_ASSET_VERSION}`;
export const brandWordmarkUrl = `${getPublicAssetUrl('feice-logo.svg')}?v=${BRAND_ASSET_VERSION}`;
export const brandFullLogoUrl = `${getPublicAssetUrl('feice-logo.svg')}?v=${BRAND_ASSET_VERSION}`;
export const brandFullLogoLoginWhiteUrl = `${getPublicAssetUrl('feice-logo-light.svg')}?v=${BRAND_ASSET_VERSION}`;
