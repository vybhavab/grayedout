import type { Config } from "tailwindcss";

export default {
	content: ["./popup/**/*.html", "./src/**/*.{ts,tsx,js,jsx,html}"],
	theme: {
		extend: {},
	},
	plugins: [],
} satisfies Config;
