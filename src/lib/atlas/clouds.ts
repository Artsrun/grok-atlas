/** Near-real-time equirectangular cloud deck (VIIRS via GIBS, hosted 3-hourly). */
export const LIVE_CLOUDS = {
  low: "https://clouds.matteason.co.uk/images/1024x512/clouds.jpg",
  mid: "https://clouds.matteason.co.uk/images/1024x512/clouds.jpg",
  high: "https://clouds.matteason.co.uk/images/2048x1024/clouds.jpg",
} as const;

export function liveCloudUrl(tier: "low" | "mid" | "high"): string {
  return LIVE_CLOUDS[tier];
}
