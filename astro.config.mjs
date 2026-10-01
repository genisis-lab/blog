import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import { d1, r2, sandbox, kvCache } from "@emdash-cms/cloudflare";
import { defineConfig, fontProviders } from "astro/config";
import emdash from "emdash/astro";

export default defineConfig({
	output: "server",
	i18n: { defaultLocale: "en", locales: ["en", "es"], fallback: { es: "en" } },
	adapter: cloudflare(),
	image: {
		layout: "constrained",
		responsiveStyles: true,
	},
	integrations: [
		{
			name: "blog-spanish-routes",
			hooks: {
				"astro:config:setup": ({ injectRoute }) => {
					// Share server-rendered templates across languages.
					for (const [pattern, page] of [
						["/es", "index.astro"],
						["/es/posts", "posts/index.astro"],
						["/es/posts/[slug]", "posts/[slug].astro"],
						["/es/pages/[slug]", "pages/[slug].astro"],
						["/es/category/[slug]", "category/[slug].astro"],
						["/es/tag/[slug]", "tag/[slug].astro"],
						["/es/search", "search.astro"],
						["/es/contact", "contact.astro"],
						["/es/newsletter", "newsletter.astro"],
					]) injectRoute({ pattern, entrypoint: `./src/pages/${page}`, prerender: false });
				},
			},
		},
		react(),
		emdash({
			database: d1({ binding: "DB", session: "auto" }),
			storage: r2({ binding: "MEDIA" }),
			sandboxRunner: sandbox(),
			objectCache: kvCache({ binding: "CACHE" }),
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
