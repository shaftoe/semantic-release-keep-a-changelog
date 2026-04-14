import type { LintError } from "markdownlint";
import { lint } from "markdownlint/sync";

/**
 * Markdownlint config tuned for validating Keep a Changelog output.
 *
 * - MD041 (first-line-heading/first-line-h1) disabled: our changelog starts with `##`, not `#`
 * - MD013 (line-length) disabled: commit subjects shouldn't be wrapped
 * - MD033 (no-inline-html) disabled: changelogs may contain HTML links
 * - All other rules enabled to catch structural issues like missing blank
 *   lines around headings, lists, etc.
 */
const KAC_MARKDOWNLINT_CONFIG = {
	default: true,
	"first-line-heading": false,
	"line-length": false,
	"no-inline-html": false,
	"no-duplicate-heading": false,
} as const;

/**
 * Lint a markdown string with markdownlint using KaC-appropriate config.
 * Returns an array of error objects (empty if the markdown is valid).
 */
export function lintMarkdown(markdown: string): LintError[] {
	const result = lint({
		strings: { content: markdown },
		config: KAC_MARKDOWNLINT_CONFIG,
	});
	return result.content ?? [];
}

/**
 * Assert that a markdown string passes all markdownlint rules.
 * On failure, reports each violation with line number, rule, and description.
 */
export function expectValidMarkdown(markdown: string): void {
	const errors = lintMarkdown(markdown);
	if (errors.length > 0) {
		const details = errors
			.map(
				(e) =>
					`  Line ${e.lineNumber}: ${e.ruleNames.join("/")} — ${e.ruleDescription}${e.errorDetail ? ` (${e.errorDetail})` : ""}`,
			)
			.join("\n");
		throw new Error(
			`Markdown lint failed with ${errors.length} issue(s):\n${details}\n\nMarkdown content:\n${markdown}`,
		);
	}
}
