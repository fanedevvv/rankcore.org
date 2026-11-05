import { useQuery } from "@tanstack/react-query";
import { API_BASE } from "@/config/site";

export interface DiscordBotStats {
  bot: {
    username: string;
    discriminator: string;
    id: string;
    avatar: string;
  };
  servers: number;
  totalMembers: number;
  guilds: {
    id: string;
    name: string;
    icon: string | null;
    memberCount: number;
    owner: boolean;
  }[];
  shards: number;
  sessionStartLimit: {
    total: number;
    remaining: number;
    resetAfter: number;
    maxConcurrency: number;
  };
}

export const useDiscordBotStats = () => {
  return useQuery<DiscordBotStats>({
    queryKey: ["discord-bot-stats"],
    queryFn: async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      try {
        const response = await fetch(`${API_BASE}/stats`, {
          method: "GET",
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Stats request failed (${response.status}): ${errorText}`);
        }

        return (await response.json()) as DiscordBotStats;
      } finally {
        clearTimeout(timeout);
      }
    },
    networkMode: "always",
    retry: 1,
    refetchInterval: 60000,
    staleTime: 30000,
  });
};
