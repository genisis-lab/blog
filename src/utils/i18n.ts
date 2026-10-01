export function blogLocale(locale: string | undefined): "en" | "es" {
	return locale === "es" ? "es" : "en";
}

/** Keep external, API, admin and feed URLs unchanged. */
export function localizePath(path: string, locale: string): string {
	if (locale !== "es" || !path.startsWith("/") || path.startsWith("//")) return path;
	if (path === "/") return "/es/";
	if (/^\/(posts|pages|category|tag|search)(\/|\?|#|$)/.test(path)) return `/es${path}`;
	return path;
}

export function uiText(locale: string, english: string, spanish: string): string {
	return locale === "es" ? spanish : english;
}
