import axios, { AxiosError } from "axios";
import config from "../config";
import { getToken } from "./auth";

const larkClient = axios.create({
  baseURL: config.lark.baseUrl,
  timeout: 15_000,
});

larkClient.interceptors.request.use(async (cfg) => {
  const token = await getToken();
  cfg.headers = cfg.headers ?? {};
  cfg.headers["Authorization"] = `Bearer ${token}`;
  return cfg;
});

larkClient.interceptors.response.use(
  (res) => {
    const { code, msg } = res.data ?? {};
    if (code !== undefined && code !== 0) {
      const err = new Error(`Lark API error ${code}: ${msg}`) as AxiosError;
      (err as any).larkCode = code;
      throw err;
    }
    return res;
  },
  (err) => Promise.reject(err)
);

export default larkClient;
