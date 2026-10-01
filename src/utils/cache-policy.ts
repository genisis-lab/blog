/** Only anonymous, published reading pages may enter the shared HTML cache. */
export function isPublicReadingRequest(request: Request): boolean {
	const url = new URL(request.url);
	if (request.method !== "GET" && request.method !== "HEAD") return false;
	if (request.headers.has("Authorization")) return false;
	if (url.searchParams.has("_preview") || url.searchParams.has("_edit")) return false;
	if (/(?:^|;\s*)emdash-edit-mode=true(?:;|$)/.test(request.headers.get("Cookie") ?? "")) return false;
	return /^\/(?:posts\/?|(?:posts|pages|category|tag)\/[^/]+\/?|)$/.test(url.pathname);
}

type CacheContext = {
	request: Request;
	locals: { user?: unknown };
	cache?: { set(value: false): void };
};

export function applyPublicCachePolicy(context: CacheContext, response: Response): Response {
	const existing = response.headers.get("Cache-Control") ?? "";
	const shared = isPublicReadingRequest(context.request)
		&& !context.locals.user
		&& response.status === 200
		&& response.headers.get("Content-Type")?.includes("text/html")
		&& !response.headers.has("Set-Cookie")
		&& !/\b(?:private|no-store)\b/i.test(existing);
	if (!shared) {
		// Disable Astro's cache after rendering, so later component hints cannot
		// restore a public CDN policy on editor, preview, API, or form responses.
		context.cache?.set(false);
		response.headers.set("Cache-Control", "private, no-store");
		response.headers.set("Cloudflare-CDN-Cache-Control", "private, no-store");
		response.headers.delete("Cache-Tag");
	}
	return response;
}
