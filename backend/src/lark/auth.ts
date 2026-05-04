import axios from "axios";
import config from "../config";

interface TokenCache {
  token: string;
  expiresAt: number;
}

let cache: TokenCache | null = null;

export async function getToken(): Promise<string> {
  const now = Date.now();
  if (cache && cache.expiresAt - now > 60_000) {
    return cache.token;
  }

  const res = await axios.post(
    `${config.lark.baseUrl}/auth/v3/tenant_access_token/internal`,
    { app_id: config.lark.appId, app_secret: config.lark.appSecret }
  );

  const { code, tenant_access_token, expire } = res.data;
  if (code !== 0) {
    throw new Error(`Lark auth failed: ${res.data.msg}`);
  }

  cache = {
    token: tenant_access_token,
    expiresAt: now + expire * 1000,
  };

  return cache.token;
}
