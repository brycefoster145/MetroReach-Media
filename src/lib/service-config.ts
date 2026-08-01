export interface ServiceGenerationConfig {
  postsPerDay: number;
  platforms: Array<"facebook" | "instagram">;
  totalPosts: number;
  schedule: {
    instagram: string[];
    facebook: string[];
  };
}

const GENERIC_CONFIG: ServiceGenerationConfig = {
  postsPerDay: 0,
  platforms: ["facebook", "instagram"],
  totalPosts: 12,
  schedule: {
    instagram: ["13:00", "17:00", "21:00"],
    facebook: ["14:00", "20:00"],
  },
};

export const SERVICE_CONFIG: Record<string, ServiceGenerationConfig> = {
  "vip-daily": {
    postsPerDay: 6,
    platforms: ["facebook", "instagram"],
    totalPosts: 180,
    schedule: {
      instagram: ["09:00", "12:00", "15:00", "18:00", "21:00"],
      facebook: ["14:00"],
    },
  },
};

export function getServiceConfig(serviceSlug?: string | null): ServiceGenerationConfig {
  return SERVICE_CONFIG[serviceSlug || ""] || GENERIC_CONFIG;
}

export function isVipDaily(serviceSlug?: string | null): boolean {
  return serviceSlug === "vip-daily";
}
