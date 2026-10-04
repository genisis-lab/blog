/** Only anonymous, published reading pages may enter the shared HTML cache. */
export function isPublicReadingRequest(request: Request): boolean {
	const url = new URL(request.url);
	if (request.method !== "GET" && request.method !== "HEAD") return false;
	if (request.headers.has("Authorization")) return false;
	if (url.searchParams.has("_preview") || url.searchParams.has("_edit")) return false;
	if (/(?:^|;\s*)emdash-edit-mode=true(?:;|$)/.test(request.headers.get("Cookie") ?? "")) return false;
	return /^\/(?:posts\/?|(?:posts|pages|category|tag)\/[^/]+\/?|)$/.test(url.pathname);
}

/** EmDash media files and Astro's image-transform endpoint (featured images, avatars). */
const MEDIA_PATH = /^\/(?:_image\/?|_emdash\/api\/media\/file\/[^/]+)$/;
/**
 * EmDash serves images as `max-age=0, must-revalidate` because "Replace
 * original" can overwrite a key, so every view re-ran the R2 read and image
 * transform. A day of caching bounds how long a replaced image can linger.
 */
export const MEDIA_CACHE_CONTROL = "public, max-age=86400, stale-while-revalidate=604800";

function isPublicMediaResponse(request: Request, response: Response): boolean {
	if (request.headers.has("Authorization")) return false;
	if (request.method !== "GET" && request.method !== "HEAD") return false;
	if (!MEDIA_PATH.test(new URL(request.url).pathname)) return false;
	return response.status === 200
		&& /\bpublic\b/i.test(response.headers.get("Cache-Control") ?? "")
		&& !/\b(?:private|no-store)\b/i.test(response.headers.get("Cache-Control") ?? "")
		&& !response.headers.has("Set-Cookie");
}

type CacheContext = {
	request: Request;
	locals: { user?: unknown };
	cache?: { set(value: false): void };
};

export function applyPublicCachePolicy(context: CacheContext, response: Response): Response {
	const existing = response.headers.get("Cache-Control") ?? "";
	if (!context.locals.user && isPublicMediaResponse(context.request, response)) {
		// Already-public media keeps its policy; only lift the revalidate-every-view default.
		if (/\bmax-age=0\b/.test(existing)) {
			response.headers.set("Cache-Control", MEDIA_CACHE_CONTROL);
			response.headers.set("Cloudflare-CDN-Cache-Control", MEDIA_CACHE_CONTROL);
		}
		return response;
	}
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
