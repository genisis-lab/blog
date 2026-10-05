import type { EmailDeliverEvent } from "emdash/plugin";

export const RESEND_PLUGIN_ID = "r_w7bflj54ux44d3j4";
export const BULLETIN_PLUGIN_ID = "r_nqufahfpg3jo7lbq";

export async function deliverSiteEmail(
	event: EmailDeliverEvent,
	settings: Record<string, unknown>,
	send: typeof fetch = fetch,
): Promise<void> {
	const apiKey = typeof settings.apiKey === "string" ? settings.apiKey.trim() : "";
	const transactionalFrom = typeof settings.from === "string" ? settings.from.trim() : "";
	if (!apiKey || !transactionalFrom) throw new Error("Complete the Resend plugin's API key and From settings.");
	const newsletter = event.source === BULLETIN_PLUGIN_ID;
	const { message } = event;
	const payload = {
		from: newsletter ? "Built WAI Newsletter <newsletters@contact.builtwai.com>" : transactionalFrom,
		to: [message.to],
		...(message.cc?.length ? { cc: message.cc } : {}),
		...(message.replyTo || newsletter ? { reply_to: message.replyTo || "hello@builtwai.com" } : {}),
		subject: message.subject,
		text: message.text,
		...(message.html ? { html: message.html } : {}),
	};
	for (let attempt = 0; attempt < 3; attempt++) {
		const response = await send("https://api.resend.com/emails", {
			method: "POST",
			headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
			body: JSON.stringify(payload),
			signal: AbortSignal.timeout(10_000),
		});
		if (response.ok) return;
		// A 429 rejected the send. Retry those only; an ambiguous delivery failure
		// must not create duplicate emails. Never log provider bodies or secrets.
		await response.body?.cancel();
		if (response.status !== 429 || attempt === 2) {
			throw new Error(`Resend rejected the email (HTTP ${response.status}).`);
		}
		await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
	}
}
