import { createSandboxRunner as createCloudflareSandboxRunner } from "@emdash-cms/cloudflare/sandbox";

// Bulletin reads 11 settings before its admin route can query subscribers or
// campaigns. EmDash's default budget of 10 rejects those ordinary page loads.
// Keep a finite RPC budget and preserve the adapter's other resource limits.
export const createSandboxRunner: typeof createCloudflareSandboxRunner = (options) =>
	createCloudflareSandboxRunner({
		...options,
		limits: {
			...options.limits,
			subrequests: options.limits?.subrequests ?? 50,
		},
	});
