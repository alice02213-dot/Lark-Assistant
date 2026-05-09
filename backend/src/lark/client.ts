import axios, { AxiosError, InternalAxiosRequestConfig, AxiosResponse } from "axios";
import https from "https";
import config from "../config";
import { getToken } from "./auth";

const debug = process.env.LARK_DEBUG === "true";

function log(direction: "→" | "←", label: string, data: unknown) {
  const ts = new Date().toISOString();
  console.log(`[Lark ${direction}] ${ts} ${label}`);
  console.log(JSON.stringify(data, null, 2));
}

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const larkClient = axios.create({
  baseURL: config.lark.baseUrl,
  timeout: 15_000,
  httpsAgent,
});

larkClient.interceptors.request.use(async (cfg: InternalAxiosRequestConfig) => {
  const token = await getToken();
  cfg.headers = cfg.headers ?? {};
  cfg.headers["Authorization"] = `Bearer ${token}`;

  if (debug) {
    log("→", `${cfg.method?.toUpperCase()} ${cfg.baseURL}${cfg.url}`, {
      params: cfg.params,
      body: cfg.data,
    });
  }

  return cfg;
});

larkClient.interceptors.response.use(
  (res: AxiosResponse) => {
    if (debug) {
      log("←", `${res.status} ${res.config.url}`, res.data);
    }

    const { code, msg } = res.data ?? {};
    if (code !== undefined && code !== 0) {
      const err = new Error(`Lark API error ${code}: ${msg}`) as AxiosError;
      (err as any).larkCode = code;
      throw err;
    }
    return res;
  },
  (err: AxiosError) => {
    if (debug) {
      log("←", `ERROR ${err.config?.url}`, {
        code: err.code,
        status: err.response?.status,
        data: err.response?.data,
        message: err.message,
      });
    }
    return Promise.reject(err);
  }
);

export default larkClient;
