import { test } from "node:test";
import assert from "node:assert/strict";
import { applyPublicCachePolicy, MEDIA_CACHE_CONTROL } from "../src/utils/cache-policy.ts";

function render(path: string, options: {
	method?: string; user?: unknown; headers?: Record<string, string>;
	responseHeaders?: Record<string, string>; status?: number;
} = {}) {
	let disabled = false;
	const context = {
		request: new Request(`https://blog.builtwai.com${path}`, { method: options.method, headers: options.headers }),
		locals: { user: options.user },
		cache: { set(value: false) { disabled = value === false; } },
	};
	const response = applyPublicCachePolicy(context, new Response("page", {
		status: options.status ?? 200,
		headers: { "Content-Type": "text/html", ...options.responseHeaders },
	}));
	return { response, disabled };
}

test("anonymous reading pages keep their query-driven cache hints", () => {
	for (const path of ["/", "/posts", "/posts/story", "/posts/story/", "/pages/about", "/category/ai", "/tag/tools"]) {
		const { disabled, response } = render(path, { headers: { Cookie: "theme=dark" } });
		assert.equal(disabled, false, path);
		assert.equal(response.headers.has("Cloudflare-CDN-Cache-Control"), false);
	}
	assert.equal(render("/posts/story", { method: "HEAD" }).disabled, false);
});

test("editor identity, draft/edit URLs and authenticated requests are never stored", () => {
	for (const options of [
		{ user: { email: "editor@example.test" } },
		{ headers: { Authorization: "Bearer test" } },
		{ headers: { Cookie: "theme=dark; emdash-edit-mode=true" } },
	]) assert.equal(render("/posts/story", options).disabled, true);
	for (const path of ["/posts/story?_preview=test", "/posts/story?_edit", "/posts/story?_edit=false"])
		assert.equal(render(path).disabled, true);
});

test("APIs, forms, search and non-success responses stay fresh", () => {
	for (const path of ["/_emdash/admin", "/_emdash/api/comments/posts/id", "/newsletter", "/contact", "/search?q=hello", "/unknown"])
		assert.equal(render(path).disabled, true, path);
	assert.equal(render("/posts/story", { method: "POST" }).disabled, true);
	assert.equal(render("/posts/story", { status: 404 }).disabled, true);
	assert.equal(render("/posts/story", { status: 500 }).disabled, true);
});

test("private and cookie-setting renders cannot retain public CDN headers", () => {
	for (const responseHeaders of [{ "Cache-Control": "private, no-store" }, { "Set-Cookie": "session=test" }]) {
		const { disabled, response } = render("/posts/story", { responseHeaders: {
			"Cloudflare-CDN-Cache-Control": "public, max-age=300", "Cache-Tag": "posts", ...responseHeaders,
		} });
		assert.equal(disabled, true);
		assert.equal(response.headers.get("Cloudflare-CDN-Cache-Control"), "private, no-store");
		assert.equal(response.headers.get("Cache-Control"), "private, no-store");
		assert.equal(response.headers.has("Cache-Tag"), false);
	}
});

test("public media and image transforms are cached instead of refetched every view", () => {
	const mutable = { "Content-Type": "image/webp", "Cache-Control": "public, max-age=0, must-revalidate" };
	for (const path of ["/_image?href=%2F_emdash%2Fapi%2Fmedia%2Ffile%2F01ABC.png&w=960", "/_emdash/api/media/file/01ABC.png"]) {
		const { disabled, response } = render(path, { responseHeaders: mutable, headers: { Cookie: "theme=dark" } });
		assert.equal(disabled, false, path);
		assert.equal(response.headers.get("Cache-Control"), MEDIA_CACHE_CONTROL, path);
		assert.equal(response.headers.get("Cloudflare-CDN-Cache-Control"), MEDIA_CACHE_CONTROL, path);
	}
	const immutable = "public, max-age=31536000, immutable";
	const pdf = render("/_emdash/api/media/file/01ABC.pdf", { responseHeaders: { "Cache-Control": immutable } }).response;
	assert.equal(pdf.headers.get("Cache-Control"), immutable);
});

test("media stays private when it is not a public success response", () => {
	for (const options of [
		{ status: 404, responseHeaders: { "Cache-Control": "public, max-age=0" } },
		{ responseHeaders: { "Cache-Control": "private, no-store" } },
		{ responseHeaders: { "Cache-Control": "public, max-age=0", "Set-Cookie": "session=test" } },
		{ method: "POST", responseHeaders: { "Cache-Control": "public, max-age=0" } },
	]) assert.equal(render("/_emdash/api/media/file/01ABC.png", options).response.headers.get("Cache-Control"), "private, no-store");
	for (const path of ["/_emdash/api/media", "/_emdash/api/media/01ABC", "/_emdash/api/media/file/a/b"])
		assert.equal(render(path, { responseHeaders: { "Cache-Control": "public, max-age=0" } }).disabled, true, path);
});


test("media never overrides authenticated or restrictive cache responses", () => {
	for (const options of [
		{ user: { email: "editor@example.test" }, responseHeaders: { "Cache-Control": "public, max-age=0" } },
		{ headers: { Authorization: "Bearer test" }, responseHeaders: { "Cache-Control": "public, max-age=0" } },
		{ responseHeaders: { "Cache-Control": "public, no-store, max-age=0" } },
		{ responseHeaders: { "Cache-Control": "public, private, max-age=0" } },
	]) {
		const { response, disabled } = render("/_emdash/api/media/file/image.png", options);
		assert.equal(disabled, true);
		assert.equal(response.headers.get("Cloudflare-CDN-Cache-Control"), "private, no-store");
	}
});
