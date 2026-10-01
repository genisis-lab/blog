import cloudflare from "@astrojs/cloudflare";
import { cacheCloudflare } from "@astrojs/cloudflare/cache";
import react from "@astrojs/react";
import { d1, r2, sandbox, kvCache } from "@emdash-cms/cloudflare";
import { defineConfig, fontProviders } from "astro/config";
import emdash from "emdash/astro";

export default defineConfig({
	output: "server",

	adapter: cloudflare(),
	cache: { provider: cacheCloudflare() },
	// Cache finished public pages; EmDash query hints provide invalidation tags.
	routeRules: {
		"/": { maxAge: 300, swr: 60 },
		"/posts": { maxAge: 300, swr: 60 },
		"/posts/[slug]": { maxAge: 300, swr: 60 },
		"/pages/[slug]": { maxAge: 300, swr: 60 },
		"/category/[slug]": { maxAge: 300, swr: 60 },
		"/tag/[slug]": { maxAge: 300, swr: 60 },
	},
	image: {
		layout: "constrained",
		responsiveStyles: true,
	},
	integrations: [
		react(),
		emdash({
			database: d1({ binding: "DB", session: "auto" }),
			storage: r2({ binding: "MEDIA" }),
			sandboxRunner: sandbox(),
			objectCache: kvCache({ binding: "CACHE" }),
			toolbar: "client",
			middleware: { outer: "./src/cache-middleware.ts" },
		}),
	],
	fonts: [
		{
			provider: fontProviders.google(),
			name: "Inter",
			cssVariable: "--font-body",
			weights: [400, 500, 600, 700],
			fallbacks: ["sans-serif"],
		},
		{
			provider: fontProviders.google(),
			name: "JetBrains Mono",
			cssVariable: "--font-mono",
			weights: [400, 500],
			fallbacks: ["monospace"],
		},
	],
	devToolbar: { enabled: false },
});
