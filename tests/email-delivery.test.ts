import assert from "node:assert/strict";
import test from "node:test";
import { deliverSiteEmail, BULLETIN_PLUGIN_ID } from "../src/plugins/email-delivery.ts";

const settings = { apiKey: "test-key", from: "Built WAI <noreply@builtwai.com>" };
const message = { to: "reader@example.com", subject: "New post", text: "Read the post", html: "<p>Read the post</p>" };

for (const source of [BULLETIN_PLUGIN_ID, "system", "r_hslxqt6ipu64hubq"]) {
	test(`sender routing preserves delivery fields for ${source}`, async () => {
		let body: Record<string, unknown> | undefined;
		const send: typeof fetch = async (url, options) => {
			assert.equal(url, "https://api.resend.com/emails");
			assert.equal(new Headers(options?.headers).get("Authorization"), "Bearer test-key");
			body = JSON.parse(String(options?.body));
			return new Response("{}", { status: 200 });
		};
		await deliverSiteEmail({ source, message }, settings, send);
		assert.deepEqual(body?.to, [message.to]);
		assert.equal(body?.subject, message.subject);
		assert.equal(body?.text, message.text);
		assert.equal(body?.html, message.html);
		assert.equal(body?.from, source === BULLETIN_PLUGIN_ID
			? "Built WAI Newsletter <newsletters@contact.builtwai.com>" : settings.from);
		assert.equal(body?.reply_to, source === BULLETIN_PLUGIN_ID ? "hello@builtwai.com" : undefined);
	});
}

test("explicit reply-to and cc survive delivery", async () => {
	await deliverSiteEmail({ source: "system", message: { ...message, replyTo: "hello@builtwai.com", cc: ["copy@example.com"] } }, settings,
		async (_url, options) => {
			const body = JSON.parse(String(options?.body));
			assert.equal(body.reply_to, "hello@builtwai.com");
			assert.deepEqual(body.cc, ["copy@example.com"]);
			return new Response("{}", { status: 200 });
		});
});

test("ambiguous server errors are not retried and do not expose provider responses", async () => {
	let calls = 0;
	await assert.rejects(deliverSiteEmail({ source: "system", message }, settings, async () => {
		calls++;
		return new Response("sensitive provider details", { status: 500 });
	}), { message: "Resend rejected the email (HTTP 500)." });
	assert.equal(calls, 1);
});

test("missing credentials fail before sending", async () => {
	await assert.rejects(deliverSiteEmail({ source: "system", message }, {}, async () => {
		assert.fail("must not send without credentials");
	}), /Complete the Resend plugin/);
});
