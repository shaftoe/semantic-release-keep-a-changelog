/**
 * Semantic Release configuration.
 *
 * Uses this repo's own plugin (semantic-release-keep-a-changelog) as both the
 * release-notes-generator AND the changelog updater, replacing:
 *   - @semantic-release/release-notes-generator
 *   - @semantic-release/changelog
 *
 * Uses @semantic-release/exec to run format/lint fixes after CHANGELOG.md
 * and package.json are updated, ensuring committed files always pass validation.
 */

export default {
	branches: ["master"],
	plugins: [
		[
			"@semantic-release/commit-analyzer",
			{
				releaseRules: [{ type: "chore", scope: "deps", release: "patch" }],
			},
		],
		"./dist/index.js",
		[
			"@semantic-release/npm",
			{
				npmPublish: true,
			},
		],
		[
			"@semantic-release/exec",
			{
				prepareCmd: "bun run format",
			},
		],
		[
			"@semantic-release/git",
			{
				assets: ["package.json", "CHANGELOG.md"],
				message:
					// biome-ignore lint/suspicious/noTemplateCurlyInString: semantic-release template variables
					"chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}",
			},
		],
		[
			"@semantic-release/github",
			{
				successComment: false,
			},
		],
	],
	// biome-ignore lint/suspicious/noTemplateCurlyInString: semantic-release template variable
	tagFormat: "v${version}",
};
