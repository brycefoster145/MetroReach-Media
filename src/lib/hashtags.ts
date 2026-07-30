/**
 * Platform-specific hashtag generation — src/lib/hashtags.ts
 *
 * Provides getHashtags(platform, content) for generating platform-appropriate
 * hashtag sets. #MetroReachMedia is always included as the first hashtag.
 *
 * Counts per platform:
 *   Instagram: 20-25 (maximum discoverability — full allowance)
 *   Facebook:  3-5 (targeted, professional)
 *   X:         1-2 (space-constrained)
 *   LinkedIn:  3-5 (professional networking)
 *   TikTok:    3-5
 *   Google:    3-5
 *
 * MetroReach Media
 */

/** Platform-specific hashtag pools — always includes #MetroReachMedia */
const HASHTAG_POOLS: Record<string, string[]> = {
  instagram: [
    "#MetroReachMedia",
    "#SocialMediaMarketing",
    "#ContentStrategy",
    "#GrowYourBusiness",
    "#MarketingAgency",
    "#LeadGeneration",
    "#DigitalMarketing",
    "#BusinessGrowth",
    "#MarketingTips",
    "#BrandBuilding",
    "#OrganicGrowth",
    "#SocialMediaManager",
    "#MarketingStrategy",
    "#SmallBusinessMarketing",
    "#ContentMarketing",
    "#SocialMediaGrowth",
    "#BrandStrategy",
    "#MarketingLife",
    "#BusinessOwner",
    "#EntrepreneurLife",
    "#OnlineMarketing",
    "#ViralMarketing",
    "#Marketing101",
    "#GrowthHacking",
    "#CreativeAgency",
    "#B2BMarketing",
    "#MarketingAgencyLife",
    "#InstaMarketing",
    "#ContentCreator",
    "#BrandIdentity",
  ],
  facebook: [
    "#MetroReachMedia",
    "#SocialMediaMarketing",
    "#GrowYourBusiness",
    "#MarketingAgency",
    "#LeadGeneration",
    "#BusinessGrowth",
    "#ContentStrategy",
    "#MarketingTips",
  ],
  x: [
    "#MetroReachMedia",
    "#Marketing",
    "#Growth",
    "#SocialMedia",
    "#Content",
    "#Business",
  ],
  linkedin: [
    "#MetroReachMedia",
    "#MarketingStrategy",
    "#BusinessGrowth",
    "#SocialMediaMarketing",
    "#LeadGeneration",
    "#DigitalMarketing",
    "#ContentStrategy",
    "#B2BMarketing",
  ],
  tiktok: [
    "#MetroReachMedia",
    "#Marketing",
    "#BusinessGrowth",
    "#SocialMediaTips",
    "#GrowYourBusiness",
    "#SmallBusiness",
    "#MarketingHacks",
  ],
  google: [
    "#MetroReachMedia",
    "#Marketing",
    "#BusinessGrowth",
    "#DigitalMarketing",
    "#LeadGeneration",
    "#ContentMarketing",
    "#OnlineMarketing",
  ],
};

/** Number of hashtags per platform [min, max] */
const HASHTAG_COUNTS: Record<string, [number, number]> = {
  instagram: [20, 25],
  facebook: [3, 5],
  x: [1, 2],
  linkedin: [3, 5],
  tiktok: [3, 5],
  google: [3, 5],
};

/**
 * Generate platform-appropriate hashtags.
 *
 * @param platform - lowercase platform name (instagram, facebook, x, etc.)
 * @param _content  - post content (unused currently; reserved for future AI-driven hashtag selection)
 * @returns space-separated hashtag string with #MetroReachMedia always first
 */
export function getHashtags(platform: string, _content: string): string {
  const pool = HASHTAG_POOLS[platform] ?? HASHTAG_POOLS.instagram;
  const [min, max] = HASHTAG_COUNTS[platform] ?? [3, 5];

  const mandatory = "#MetroReachMedia";

  // Exclude the mandatory tag from the pool (always first in output)
  const remaining = pool.filter((h) => h !== mandatory);

  // Shuffle and pick a random count within the platform range
  const shuffled = [...remaining].sort(() => Math.random() - 0.5);
  const additional = min - 1 + Math.floor(Math.random() * (max - min + 1));

  return [mandatory, ...shuffled.slice(0, additional)].join(" ");
}
