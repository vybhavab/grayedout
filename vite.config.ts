import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./src/manifest";

// We use a multi-page build so popup HTML is processed by Vite
export default defineConfig({
	plugins: [react(), crx({ manifest })],
	publicDir: "public",
	build: {
		outDir: "dist",
	},
});
