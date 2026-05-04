const required = (key: string): string => {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
};

const config = Object.freeze({
  lark: {
    appId: required("LARK_APP_ID"),
    appSecret: required("LARK_APP_SECRET"),
    calendarId: process.env.LARK_CALENDAR_ID ?? "primary",
    baseUrl: "https://open.feishu.cn/open-apis",
  },
  cron: {
    timezone: process.env.CRON_TIMEZONE ?? "Asia/Hong_Kong",
  },
  port: parseInt(process.env.PORT ?? "3001", 10),
  dataDir: process.env.DATA_DIR ?? (process.env.NODE_ENV === "production" ? "/app/data" : "./data"),
});

export default config;
