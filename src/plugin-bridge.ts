import { PluginBridge as CloudflarePluginBridge } from "@emdash-cms/cloudflare/sandbox";
import { getPluginSettings } from "emdash";
import { deliverSiteEmail, BULLETIN_PLUGIN_ID, RESEND_PLUGIN_ID } from "./plugins/email-delivery";
import { PLUGIN_KV_PREFIX_SQL } from "./plugins/kv-prefix";

const CONTACT_PLUGIN_ID = "r_hslxqt6ipu64hubq";

export class PluginBridge extends CloudflarePluginBridge {
	override async emailSend(message: Parameters<CloudflarePluginBridge["emailSend"]>[0]): Promise<void> {
		const { pluginId, capabilities } = this.ctx.props;
		if (!capabilities.includes("email:send")) throw new Error("Missing capability: email:send");
		if (pluginId !== BULLETIN_PLUGIN_ID && pluginId !== CONTACT_PLUGIN_ID) {
			return super.emailSend(message);
		}
		// Loopback RPC can run in an isolate where EmDash's in-memory email
		// callback has not been initialized. Resolve this site's transport here.
		await deliverSiteEmail({ source: pluginId, message }, await getPluginSettings(RESEND_PLUGIN_ID));
	}

	override async kvList(prefix = ""): Promise<Array<{ key: string; value: unknown }>> {
		// Preserve the adapter's settings merging and secret redaction paths.
		if ("settings:".startsWith(prefix) || prefix.startsWith("settings:")) {
			return super.kvList(prefix);
		}
		// Contact Forms uses a form ID + IP hash as a prefix. D1 caps LIKE
		// patterns at 50 bytes; literal prefix matching works for longer keys.
		const result = await this.env.DB.prepare(PLUGIN_KV_PREFIX_SQL)
			.bind(this.ctx.props.pluginId, prefix, prefix).all<{ id: string; data: string }>();
		return (result.results ?? []).map((row) => ({ key: row.id, value: JSON.parse(row.data) }));
	}
}
