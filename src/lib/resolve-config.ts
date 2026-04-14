import { CHANGELOG_TITLE, DEFAULT_CHANGELOG_FILE } from "./constants.js";

export interface ResolvedConfig {
	changelogFile: string;
	changelogTitle: string;
}

/**
 * Resolve plugin configuration with defaults.
 */
export function resolveConfig(
	pluginConfig: Record<string, unknown> = {},
): ResolvedConfig {
	return {
		changelogFile:
			(pluginConfig.changelogFile as string) || DEFAULT_CHANGELOG_FILE,
		changelogTitle: (pluginConfig.changelogTitle as string) ?? CHANGELOG_TITLE,
	};
}
