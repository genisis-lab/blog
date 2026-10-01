import { test } from "node:test";
import assert from "node:assert/strict";
import { applyPublicCachePolicy } from "../src/utils/cache-policy.ts";

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
