import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0b0d10",
        paper: "#fafaf7",
        accent: "#3b6cf2",
      },
    },
  },
  plugins: [],
} satisfies Config;
