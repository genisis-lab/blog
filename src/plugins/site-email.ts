import { definePlugin, getPluginSettings } from "emdash";
import { deliverSiteEmail, RESEND_PLUGIN_ID } from "./email-delivery";

// Reuse the existing encrypted Resend credentials. Bulletin gets a dedicated
// sender while system and contact emails retain the configured From address.
export function createPlugin() {
	return definePlugin({
		id: "builtwai-email",
		version: "1.0.0",
		capabilities: ["hooks.email-transport:register"],
		hooks: {
			"email:deliver": {
				exclusive: true,
				handler: async (event) => deliverSiteEmail(event, await getPluginSettings(RESEND_PLUGIN_ID)),
			},
		},
	});
}
