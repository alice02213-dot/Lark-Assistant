import axios from "axios";
import https from "https";
import config from "../config";

const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const debug = process.env.LARK_DEBUG === "true";

function tokenHint(token: string) {
  return `${token.slice(0, 8)}...${token.slice(-4)}`;
}

function authLog(msg: string, meta?: Record<string, unknown>) {
  if (!debug) return;
  const ts = new Date().toISOString();
  console.log(`[Lark Auth] ${ts} ${msg}`, meta ? JSON.stringify(meta) : "");
}

interface TokenCache {
  token: string;
  expiresAt: number;
}

let cache: TokenCache | null = null;

export async function getToken(): Promise<string> {
  const now = Date.now();

  if (cache && cache.expiresAt - now > 60_000) {
    authLog("cache hit", {
      token: tokenHint(cache.token),
      expiresIn: `${Math.round((cache.expiresAt - now) / 1000)}s`,
    });
    return cache.token;
  }

  authLog("fetching new token", { app_id: config.lark.appId });

  const res = await axios.post(
    `${config.lark.baseUrl}/auth/v3/tenant_access_token/internal`,
    { app_id: config.lark.appId, app_secret: config.lark.appSecret },
    { httpsAgent, timeout: 15_000 }
  );

  const { code, tenant_access_token, expire } = res.data;
  if (code !== 0) {
    authLog("token fetch failed", { code, msg: res.data.msg });
    throw new Error(`Lark auth failed: ${res.data.msg}`);
  }

  cache = {
    token: tenant_access_token,
    expiresAt: now + expire * 1000,
  };

  authLog("token issued", {
    token: tokenHint(cache.token),
    expire: `${expire}s`,
    expiresAt: new Date(cache.expiresAt).toISOString(),
  });

  return cache.token;
}
