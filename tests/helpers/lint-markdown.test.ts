import { describe, expect, it } from "bun:test";
import { expectValidMarkdown, lintMarkdown } from "./lint-markdown.js";

describe("lintMarkdown", () => {
	it("returns empty array for valid markdown", () => {
		const markdown = `# Changelog

## [1.0.0] - 2024-01-01

### Added

- New feature
`;
		const errors = lintMarkdown(markdown);
		expect(errors).toEqual([]);
	});

	it("returns errors for markdown with missing blank line before heading", () => {
		const markdown = `# Changelog
## [1.0.0] - 2024-01-01

### Added

- New feature
`;
		const errors = lintMarkdown(markdown);
		expect(errors.length).toBeGreaterThan(0);
		expect(errors[0]?.ruleNames).toContain("MD022");
	});

	it("returns errors for markdown with missing blank line before list", () => {
		const markdown = `# Changelog

## [1.0.0] - 2024-01-01
### Added
- New feature
`;
		const errors = lintMarkdown(markdown);
		expect(errors.length).toBeGreaterThan(0);
		// MD022 (blanks-around-headings) or MD032 (blanks-around-lists)
		expect(
			errors.some(
				(e) => e.ruleNames.includes("MD022") || e.ruleNames.includes("MD032"),
			),
		).toBe(true);
	});

	it("returns errors for duplicate headings", () => {
		const markdown = `# Changelog

## [1.0.0] - 2024-01-01

## [1.0.0] - 2024-01-01
`;
		const errors = lintMarkdown(markdown);
		// MD025 is disabled in our config, so no error expected
		expect(errors.length).toBe(0);
	});

	it("handles markdown with inline HTML (allowed by config)", () => {
		const markdown = `# Changelog

## [1.0.0] - 2024-01-01

### Added

- New feature with <strong>bold</strong> text
`;
		const errors = lintMarkdown(markdown);
		// MD033 (no-inline-html) is disabled
		expect(errors.filter((e) => e.ruleNames.includes("MD033"))).toHaveLength(0);
	});

	it("handles long lines (allowed by config)", () => {
		const markdown = `# Changelog

## [1.0.0] - 2024-01-01

### Added

- This is a very long line that exceeds the typical 80 character limit and should not trigger an error because MD013 line-length is disabled in our config
`;
		const errors = lintMarkdown(markdown);
		// MD013 (line-length) is disabled
		expect(errors.filter((e) => e.ruleNames.includes("MD013"))).toHaveLength(0);
	});

	it("handles first-line heading (allowed by config)", () => {
		const markdown = `## [1.0.0] - 2024-01-01

### Added

- New feature
`;
		const errors = lintMarkdown(markdown);
		// MD041 (first-line-heading) is disabled
		expect(errors.filter((e) => e.ruleNames.includes("MD041"))).toHaveLength(0);
	});
});

describe("expectValidMarkdown", () => {
	it("does not throw for valid markdown", () => {
		const markdown = `# Changelog

## [1.0.0] - 2024-01-01

### Added

- New feature
`;
		expect(() => expectValidMarkdown(markdown)).not.toThrow();
	});

	it("throws for invalid markdown with error details", () => {
		const markdown = `# Changelog
## [1.0.0] - 2024-01-01

### Added

- New feature
`;
		expect(() => expectValidMarkdown(markdown)).toThrow();
	});

	it("throws with formatted error message containing line number and rule", () => {
		const markdown = `# Changelog
## [1.0.0] - 2024-01-01
`;
		let threw = false;
		let error: Error | null = null;
		try {
			expectValidMarkdown(markdown);
		} catch (e) {
			threw = true;
			error = e as Error;
		}
		expect(threw).toBe(true);
		// biome-ignore lint/style/noNonNullAssertion: error is set when threw is true
		const message = error!.message;
		expect(message).toContain("Markdown lint failed");
		expect(message).toContain("Line");
		expect(message).toContain("MD");
	});

	it("throws with error count in message", () => {
		const markdown = `# Changelog
## [1.0.0] - 2024-01-01

### Added
- item 1
- item 2
`;
		let threw = false;
		let error: Error | null = null;
		try {
			expectValidMarkdown(markdown);
		} catch (e) {
			threw = true;
			error = e as Error;
		}
		expect(threw).toBe(true);
		// biome-ignore lint/style/noNonNullAssertion: error is set when threw is true
		const message = error!.message;
		expect(message).toContain("issue(s):");
	});

	it("includes the markdown content in the error message", () => {
		const markdown = `# Changelog
## [1.0.0] - 2024-01-01
`;
		let threw = false;
		let error: Error | null = null;
		try {
			expectValidMarkdown(markdown);
		} catch (e) {
			threw = true;
			error = e as Error;
		}
		expect(threw).toBe(true);
		// biome-ignore lint/style/noNonNullAssertion: error is set when threw is true
		const message = error!.message;
		expect(message).toContain("Markdown content:");
		expect(message).toContain(markdown);
	});
});
