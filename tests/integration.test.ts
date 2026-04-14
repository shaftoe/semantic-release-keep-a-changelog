import { describe, expect, it } from "bun:test";
import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateNotes } from "../src/lib/generate-notes.js";
import { prepare } from "../src/lib/prepare.js";
import { expectValidMarkdown } from "./helpers/lint-markdown.js";

async function makeTmpDir(): Promise<string> {
	return mkdtemp(join(tmpdir(), "kac-integ-"));
}

// Simulates a semantic-release pipeline for a given set of commits
async function simulateRelease(opts: {
	commits: { hash: string; message: string; committerDate: string }[];
	lastRelease: Record<string, unknown>;
	nextRelease: { version: string; gitTag?: string };
	repositoryUrl?: string;
	cwd: string;
}) {
	const { commits, lastRelease, nextRelease, repositoryUrl, cwd } = opts;

	// Step 1: generateNotes
	const notes = await generateNotes({}, {
		commits,
		lastRelease,
		nextRelease,
		options: {
			repositoryUrl: repositoryUrl ?? "https://github.com/acme/my-app.git",
		},
		cwd,
	} as Parameters<typeof generateNotes>[1]);

	// Step 2: prepare (writes to disk)
	await prepare({}, {
		cwd,
		nextRelease: { notes: notes ?? undefined },
		logger: { log: () => {} },
	} as Parameters<typeof prepare>[1]);

	// Return the file contents
	return readFile(join(cwd, "CHANGELOG.md"), "utf-8");
}

/** Find the position of a version header like "## [1.0.0]" */
function versionHeaderPos(content: string, version: string): number {
	return content.indexOf(`## [${version}]`);
}

describe("integration: full release pipeline", () => {
	it("creates changelog on first release with mixed commit types", async () => {
		const cwd = await makeTmpDir();
		try {
			const content = await simulateRelease({
				commits: [
					{
						hash: "a1b2c3d",
						message: "feat: add user authentication",
						committerDate: "2024-01-10",
					},
					{
						hash: "e4f5a6b",
						message: "fix: resolve login redirect loop",
						committerDate: "2024-01-11",
					},
					{
						hash: "c7d8e9f",
						message: "feat(ui): add dark mode toggle",
						committerDate: "2024-01-12",
					},
					{
						hash: "f1a2b3c",
						message: "perf: optimize database queries",
						committerDate: "2024-01-13",
					},
					{
						hash: "d4e5f6a",
						message: "ci: update workflow",
						committerDate: "2024-01-14",
					},
					{
						hash: "b7c8d9e",
						message: "test: add unit tests for auth",
						committerDate: "2024-01-14",
					},
				],
				lastRelease: {},
				nextRelease: { version: "1.0.0", gitTag: "v1.0.0" },
				cwd,
			});

			// Title header
			expect(content).toContain("# Changelog");
			expect(content).toContain("Keep a Changelog");
			expect(content).toContain("Semantic Versioning");

			// Version header in KaC format: ## [1.0.0] - YYYY-MM-DD
			expect(content).toContain("## [1.0.0]");
			expect(content).not.toContain("compare/");

			// KaC sections in correct order: Added before Changed before Fixed
			const addedIdx = content.indexOf("### Added");
			const changedIdx = content.indexOf("### Changed");
			const fixedIdx = content.indexOf("### Fixed");
			expect(addedIdx).toBeGreaterThan(-1);
			expect(changedIdx).toBeGreaterThan(-1);
			expect(fixedIdx).toBeGreaterThan(-1);
			// biome-ignore lint/style/noNonNullAssertion: guarded by toBeGreaterThan above
			expect(addedIdx!).toBeLessThan(changedIdx!);
			// biome-ignore lint/style/noNonNullAssertion: guarded by toBeGreaterThan above
			expect(changedIdx!).toBeLessThan(fixedIdx!);

			// Commit details
			expect(content).toContain("user authentication");
			expect(content).toContain("dark mode toggle");
			expect(content).toContain("optimize database queries");
			expect(content).toContain("resolve login redirect loop");

			// Omitted types (ci, test) should NOT appear
			expect(content).not.toContain("update workflow");
			expect(content).not.toContain("add unit tests for auth");

			// Produced markdown must be valid
			expectValidMarkdown(content);
		} finally {
			await rm(cwd, { recursive: true, force: true });
		}
	});

	it("appends second release above first and generates compare link", async () => {
		const cwd = await makeTmpDir();
		try {
			// First release
			await simulateRelease({
				commits: [
					{
						hash: "aaa1111",
						message: "feat: initial feature",
						committerDate: "2024-01-01",
					},
				],
				lastRelease: {},
				nextRelease: { version: "1.0.0", gitTag: "v1.0.0" },
				cwd,
			});

			// Second release
			const content = await simulateRelease({
				commits: [
					{
						hash: "bbb2222",
						message: "feat: add notifications",
						committerDate: "2024-02-01",
					},
					{
						hash: "ccc3333",
						message: "fix: fix crash on startup",
						committerDate: "2024-02-02",
					},
				],
				lastRelease: { gitTag: "v1.0.0" },
				nextRelease: { version: "1.1.0", gitTag: "v1.1.0" },
				cwd,
			});

			// Reference-style compare link at bottom for new release
			expect(content).toContain("[1.1.0]:");
			expect(content).toContain("compare/v1.0.0...v1.1.0");

			// New release header appears before old release header
			const v11Idx = versionHeaderPos(content, "1.1.0");
			const v10Idx = versionHeaderPos(content, "1.0.0");
			expect(v11Idx).toBeGreaterThan(-1);
			expect(v10Idx).toBeGreaterThan(-1);
			expect(v11Idx).toBeLessThan(v10Idx);

			// New commits in new section
			expect(content).toContain("add notifications");
			expect(content).toContain("fix crash on startup");
			expect(content).toContain("initial feature");

			// Produced markdown must be valid
			expectValidMarkdown(content);
		} finally {
			await rm(cwd, { recursive: true, force: true });
		}
	});

	it("accumulates three releases preserving order", async () => {
		const cwd = await makeTmpDir();
		try {
			// v1.0.0
			await simulateRelease({
				commits: [
					{
						hash: "aaaaaaa",
						message: "feat: first feature",
						committerDate: "2024-01-01",
					},
				],
				lastRelease: {},
				nextRelease: { version: "1.0.0", gitTag: "v1.0.0" },
				cwd,
			});

			// v1.1.0
			await simulateRelease({
				commits: [
					{
						hash: "bbbbbbb",
						message: "feat: second feature",
						committerDate: "2024-02-01",
					},
				],
				lastRelease: { gitTag: "v1.0.0" },
				nextRelease: { version: "1.1.0", gitTag: "v1.1.0" },
				cwd,
			});

			// v2.0.0
			const content = await simulateRelease({
				commits: [
					{
						hash: "ccccccc",
						message: "feat!: breaking change",
						committerDate: "2024-03-01",
					},
					{
						hash: "ddddddd",
						message: "fix: patch something",
						committerDate: "2024-03-02",
					},
				],
				lastRelease: { gitTag: "v1.1.0" },
				nextRelease: { version: "2.0.0", gitTag: "v2.0.0" },
				cwd,
			});

			// All three versions present, newest first
			const v20 = versionHeaderPos(content, "2.0.0");
			const v11 = versionHeaderPos(content, "1.1.0");
			const v10 = versionHeaderPos(content, "1.0.0");
			expect(v20).toBeLessThan(v11);
			expect(v11).toBeLessThan(v10);

			// Changelog title appears only once at the top
			const { CHANGELOG_TITLE } = await import("../src/lib/constants.js");
			const firstTitle = content.indexOf(CHANGELOG_TITLE);
			const secondTitle = content.indexOf(CHANGELOG_TITLE, firstTitle + 1);
			expect(firstTitle).toBe(0);
			expect(secondTitle).toBe(-1);

			// Produced markdown must be valid
			expectValidMarkdown(content);
		} finally {
			await rm(cwd, { recursive: true, force: true });
		}
	});

	it("handles Dependabot dependency update commits", async () => {
		const cwd = await makeTmpDir();
		try {
			const content = await simulateRelease({
				commits: [
					{
						hash: "dep1111",
						message: "chore(deps): bump lodash from 4.17.20 to 4.17.21",
						committerDate: "2024-01-01",
					},
					{
						hash: "dep2222",
						message: "chore(deps-dev): bump vitest from 1.0 to 1.1",
						committerDate: "2024-01-02",
					},
					{
						hash: "feat3333",
						message: "feat: new endpoint",
						committerDate: "2024-01-03",
					},
					{
						hash: "chrr4444",
						message: "chore: update eslint config",
						committerDate: "2024-01-04",
					},
				],
				lastRelease: {},
				nextRelease: { version: "1.0.0", gitTag: "v1.0.0" },
				cwd,
			});

			// deps commits map to Changed, feat maps to Added
			expect(content).toContain("### Added");
			expect(content).toContain("### Changed");
			expect(content).toContain("new endpoint");
			expect(content).toContain("bump lodash");
			expect(content).toContain("bump vitest");

			// Regular chore (no deps scope) is omitted
			expect(content).not.toContain("update eslint config");

			// Produced markdown must be valid
			expectValidMarkdown(content);
		} finally {
			await rm(cwd, { recursive: true, force: true });
		}
	});

	it("works with SSH repository URL", async () => {
		const cwd = await makeTmpDir();
		try {
			const content = await simulateRelease({
				commits: [
					{
						hash: "abc1234",
						message: "feat: something",
						committerDate: "2024-01-01",
					},
				],
				lastRelease: { gitTag: "v0.5.0" },
				nextRelease: { version: "1.0.0", gitTag: "v1.0.0" },
				repositoryUrl: "git@github.com:myorg/myrepo.git",
				cwd,
			});

			expect(content).toContain("myorg/myrepo");
			expect(content).toContain("compare/v0.5.0...v1.0.0");

			// Produced markdown must be valid
			expectValidMarkdown(content);
		} finally {
			await rm(cwd, { recursive: true, force: true });
		}
	});

	it("updates existing CHANGELOG.md with new release version", async () => {
		const cwd = await makeTmpDir();
		try {
			// Copy the test fixture CHANGELOG.md to the temp directory
			await copyFile(
				join(__dirname, "CHANGELOG.md"),
				join(cwd, "CHANGELOG.md"),
			);

			// Simulate a release that adds a new version on top of existing changelog
			const content = await simulateRelease({
				commits: [
					{
						hash: "abc1234",
						message: "feat: new awesome feature",
						committerDate: "2024-03-15",
					},
					{
						hash: "def5678",
						message: "fix: fix critical bug",
						committerDate: "2024-03-16",
					},
				],
				lastRelease: { gitTag: "v1.1.1" },
				nextRelease: { version: "1.2.0", gitTag: "v1.2.0" },
				repositoryUrl: "https://github.com/olivierlacan/keep-a-changelog.git",
				cwd,
			});

			// Verify: original file should have been replaced with modified version
			// The new version 1.2.0 should appear at the top
			const v120Idx = content.indexOf("## [1.2.0]");
			const v111Idx = content.indexOf("## [1.1.1]");
			expect(v120Idx).toBeGreaterThan(-1);
			expect(v111Idx).toBeGreaterThan(-1);
			expect(v120Idx).toBeLessThan(v111Idx);

			// New commits should be in the new version section
			expect(content).toContain("new awesome feature");
			expect(content).toContain("fix critical bug");

			// Compare link for new release should be present
			expect(content).toContain("[1.2.0]:");
			expect(content).toContain("compare/v1.1.1...v1.2.0");

			// Original Unreleased section should still be present (now at the bottom)
			expect(content).toContain("## [Unreleased]");

			// Original 1.1.1 content should be preserved
			expect(content).toContain("Arabic translation");
			expect(content).toContain("French translation");

			// Title header should only appear once at the top
			const titleCount = (content.match(/^# Changelog$/gm) || []).length;
			expect(titleCount).toBe(1);

			// The new section at the top should be valid markdown
			// Extract just title + new version 1.2.0 (NOT including Unreleased)
			// Unreleased has trailing spaces in original fixture, so we exclude it
			const newSection =
				v111Idx > 0 ? `${content.slice(0, v111Idx).trimEnd()}\n` : content;
			expectValidMarkdown(newSection);
		} finally {
			await rm(cwd, { recursive: true, force: true });
		}
	});
});
