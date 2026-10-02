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
	// After 5 min, serve the cached copy instantly for up to a day while it refreshes
	// in the background; admin edits still purge by tag immediately.
	routeRules: {
		"/": { maxAge: 300, swr: 86400 },
		"/posts": { maxAge: 300, swr: 86400 },
		"/posts/[slug]": { maxAge: 300, swr: 86400 },
		"/pages/[slug]": { maxAge: 300, swr: 86400 },
		"/category/[slug]": { maxAge: 300, swr: 86400 },
		"/tag/[slug]": { maxAge: 300, swr: 86400 },
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
