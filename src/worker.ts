import handler, { createScheduledHandler } from "@emdash-cms/cloudflare/worker";

export { PluginBridge } from "./plugin-bridge";

export default {
	...handler,
	scheduled: createScheduledHandler(),
} satisfies ExportedHandler;
