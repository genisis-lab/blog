import { defineMiddleware } from "astro:middleware";
import { applyPublicCachePolicy } from "./utils/cache-policy";

export const onRequest = defineMiddleware(async (context, next) => {
	return applyPublicCachePolicy(context, await next());
});
