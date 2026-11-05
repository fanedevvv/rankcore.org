import { useQuery } from "@tanstack/react-query";
import { API_BASE } from "@/config/site";

export interface BotCommand {
  name: string;
  desc: string;
  usage: string;
  parentName: string;
}

export interface BotCommandsResponse {
  commands: BotCommand[];
  totalRaw: number;
  totalFlattened: number;
}

export const useDiscordBotCommands = () => {
  return useQuery<BotCommandsResponse>({
    queryKey: ["discord-bot-commands"],
    queryFn: async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      try {
        const response = await fetch(`${API_BASE}/commands`, {
          method: "GET",
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Commands request failed (${response.status}): ${errorText}`);
        }

        return (await response.json()) as BotCommandsResponse;
      } finally {
        clearTimeout(timeout);
      }
    },
    networkMode: "always",
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });
};
