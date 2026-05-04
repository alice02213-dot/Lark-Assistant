import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        lark: {
          blue: "#1456F0",
          light: "#E8EFFE",
        },
      },
    },
  },
  plugins: [],
};

export default config;
