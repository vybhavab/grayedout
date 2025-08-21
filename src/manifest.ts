import { ManifestV3Export } from "@crxjs/vite-plugin";

const manifest: ManifestV3Export = {
	manifest_version: 3,
	name: "GrayedOut",
	version: "0.0.0.3",
	description: "Schedule or Always grayscale websites to reduce distractions",
	permissions: ["storage", "tabs", "alarms", "scripting"],
	host_permissions: ["<all_urls>"],
	background: {
		service_worker: "src/background/index.ts",
	},
	action: {
		default_popup: "popup/popup.html",
		default_icon: "icons/icon-128.png",
	},
	options_page: "options/options.html",
	content_scripts: [
		{
			matches: ["<all_urls>"],
			js: ["src/content/grayscale.ts"],
			run_at: "document_start",
		},
	],
	icons: {
		"128": "icons/icon-128.png",
	},
} as const;

export default manifest;

// export default {
//   manifest_version: 3,
//   name: "GrayedOut",
//   version: "0.0.0.3",
//   description: "Schedule or Always grayscale websites to reduce distractions",
//   permissions: ["storage", "tabs", "alarms", "scripting"],
//   // host_permissions: ["<all_urls>"],
//   background: {
//     service_worker: "src/background/index.ts",
//   },
//   action: {
//     default_popup: "popup/popup.html",
//     default_icon: "icons/icon-128.png",
//   },
//   options_page: "options/options.html",
//   // content_scripts: [
//   //   {
//   //     matches: ["<all_urls>"],
//   //     js: ["src/content/grayscale.ts"],
//   //     run_at: "document_start",
//   //   },
//   // ],
//   icons: {
//     "128": "icons/icon-128.png",
//   },
// } as const;
