import {
  createWorkBuddyCloud,
  type WorkBuddyCloudClient,
} from "@tencent-ai/workbuddy-cloud-sdk";

// 以下公开配置来自当前应用的 publicConfig，可随前端代码发布；不包含任何长期密钥。
const publicConfig = {
  endpoint: "https://snake-game-93838.app.workbuddy.host",
  oauthRelayBaseUrl: "https://www.workbuddy.cn/v2/as/genie-baas/oauth",
  publishableKey:
    "wbpk_QIXcfp4dlPbEcl7XMW6OBD_sgtC8XL2L7Gs05DxQKH6MCtDjLGLwO3U",
};

export type Database = {
  public: {
    Tables: {
      snake_scores: {
        Row: {
          id: number;
          player_name: string;
          score: number;
          created_at: string;
        };
        Insert: {
          id?: number;
          player_name?: string;
          score: number;
          created_at?: string;
        };
        Update: {
          id?: number;
          player_name?: string;
          score?: number;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

let client: WorkBuddyCloudClient<Database> | null = null;

export function getCloud() {
  if (!client) {
    client = createWorkBuddyCloud<Database>({
      endpoint: publicConfig.endpoint,
      oauthRelayBaseUrl: publicConfig.oauthRelayBaseUrl,
      publishableKey: publicConfig.publishableKey,
    });
  }
  return client;
}

export type ScoreRow = Database["public"]["Tables"]["snake_scores"]["Row"];
