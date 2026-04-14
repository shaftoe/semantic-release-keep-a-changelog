import { describe, expect, it } from "bun:test";
import { generateNotes } from "../src/lib/generate-notes.js";

function makeContext(overrides: Record<string, unknown> = {}) {
	return {
		commits: [] as { hash: string; message: string; committerDate: string }[],
		lastRelease: {},
		nextRelease: { version: "1.0.0" },
		options: { repositoryUrl: "https://github.com/owner/repo.git" },
		cwd: "/tmp",
		...overrides,
	};
}

describe("generateNotes", () => {
	it("produces Added section for feat commit", async () => {
		const context = makeContext({
			commits: [
				{
					hash: "a1b2c3d",
					message: "feat: add new feature",
					committerDate: "2024-01-01",
				},
			],
		});
		const result = await generateNotes(
			{},
			context as Parameters<typeof generateNotes>[1],
		);
		expect(result).toBeDefined();
		expect(result).toContain("### Added");
		expect(result).toContain("add new feature");
	});

	it("produces correct sections for multiple commit types in KaC order", async () => {
		const context = makeContext({
			commits: [
				{
					hash: "aaa1111",
					message: "fix: patch a bug",
					committerDate: "2024-01-01",
				},
				{
					hash: "bbb2222",
					message: "feat: new thing",
					committerDate: "2024-01-02",
				},
				{
					hash: "ccc3333",
					message: "perf: speed things up",
					committerDate: "2024-01-03",
				},
			],
		});
		const result = await generateNotes(
			{},
			context as Parameters<typeof generateNotes>[1],
		);
		expect(result).toBeDefined();
		// KaC order: Added, Changed, Fixed
		const addedIdx = result?.indexOf("### Added");
		const changedIdx = result?.indexOf("### Changed");
		const fixedIdx = result?.indexOf("### Fixed");
		expect(addedIdx).toBeGreaterThan(-1);
		expect(changedIdx).toBeGreaterThan(-1);
		expect(fixedIdx).toBeGreaterThan(-1);
		// biome-ignore lint/style/noNonNullAssertion: guarded by toBeGreaterThan above
		expect(addedIdx!).toBeLessThan(changedIdx!);
		// biome-ignore lint/style/noNonNullAssertion: guarded by toBeGreaterThan above
		expect(changedIdx!).toBeLessThan(fixedIdx!);
	});

	it("parses GitHub HTTPS URL correctly", async () => {
		const context = makeContext({
			commits: [
				{
					hash: "abc1234",
					message: "feat: something",
					committerDate: "2024-01-01",
				},
			],
			lastRelease: { gitTag: "v0.9.0" },
			nextRelease: { version: "1.0.0", gitTag: "v1.0.0" },
			options: { repositoryUrl: "https://github.com/myorg/myrepo.git" },
		});
		const result = await generateNotes(
			{},
			context as Parameters<typeof generateNotes>[1],
		);
		expect(result).toBeDefined();
		expect(result).toContain("myorg/myrepo");
	});

	it("parses GitHub SSH URL correctly", async () => {
		const context = makeContext({
			commits: [
				{
					hash: "abc1234",
					message: "feat: something",
					committerDate: "2024-01-01",
				},
			],
			lastRelease: { gitTag: "v0.9.0" },
			nextRelease: { version: "1.0.0", gitTag: "v1.0.0" },
			options: { repositoryUrl: "git@github.com:myorg/myrepo.git" },
		});
		const result = await generateNotes(
			{},
			context as Parameters<typeof generateNotes>[1],
		);
		expect(result).toBeDefined();
		expect(result).toContain("myorg/myrepo");
	});

	it("generates compare link when both tags exist", async () => {
		const context = makeContext({
			commits: [
				{
					hash: "abc1234",
					message: "feat: something",
					committerDate: "2024-01-01",
				},
			],
			lastRelease: { gitTag: "v0.9.0" },
			nextRelease: { version: "1.0.0", gitTag: "v1.0.0" },
			options: { repositoryUrl: "https://github.com/owner/repo.git" },
		});
		const result = await generateNotes(
			{},
			context as Parameters<typeof generateNotes>[1],
		);
		expect(result).toBeDefined();
		expect(result).toContain("compare/v0.9.0...v1.0.0");
	});

	it("does not generate compare link when no previous tag", async () => {
		const context = makeContext({
			commits: [
				{
					hash: "abc1234",
					message: "feat: something",
					committerDate: "2024-01-01",
				},
			],
			lastRelease: {},
			nextRelease: { version: "1.0.0", gitTag: "v1.0.0" },
			options: { repositoryUrl: "https://github.com/owner/repo.git" },
		});
		const result = await generateNotes(
			{},
			context as Parameters<typeof generateNotes>[1],
		);
		expect(result).toBeDefined();
		expect(result).not.toContain("compare/");
	});

	it("handles feat! breaking change syntax", async () => {
		const context = makeContext({
			commits: [
				{
					hash: "a1b2c3d",
					message: "feat!: breaking feature",
					committerDate: "2024-01-01",
				},
			],
		});
		const result = await generateNotes(
			{},
			context as Parameters<typeof generateNotes>[1],
		);
		expect(result).toBeDefined();
		expect(result).toContain("### Added");
		expect(result).toContain("breaking feature");
	});

	it("handles fix! breaking change syntax", async () => {
		const context = makeContext({
			commits: [
				{
					hash: "a1b2c3d",
					message: "fix!: breaking fix",
					committerDate: "2024-01-01",
				},
			],
		});
		const result = await generateNotes(
			{},
			context as Parameters<typeof generateNotes>[1],
		);
		expect(result).toBeDefined();
		expect(result).toContain("### Fixed");
		expect(result).toContain("breaking fix");
	});

	it("handles scoped breaking change feat(scope)!:", async () => {
		const context = makeContext({
			commits: [
				{
					hash: "a1b2c3d",
					message: "feat(api)!: redesign API",
					committerDate: "2024-01-01",
				},
			],
		});
		const result = await generateNotes(
			{},
			context as Parameters<typeof generateNotes>[1],
		);
		expect(result).toBeDefined();
		expect(result).toContain("### Added");
		expect(result).toContain("**api**");
		expect(result).toContain("redesign API");
	});

	it("handles BREAKING CHANGE footer", async () => {
		const context = makeContext({
			commits: [
				{
					hash: "a1b2c3d",
					message: "feat: new feature\n\nBREAKING CHANGE: old API removed",
					committerDate: "2024-01-01",
				},
			],
		});
		const result = await generateNotes(
			{},
			context as Parameters<typeof generateNotes>[1],
		);
		expect(result).toBeDefined();
		expect(result).toContain("### Added");
		expect(result).toContain("new feature");
	});

	it("handles feat! with BREAKING CHANGE footer", async () => {
		const context = makeContext({
			commits: [
				{
					hash: "a1b2c3d",
					message:
						"feat(api)!: redesign API\n\nBREAKING CHANGE: the old API is gone",
					committerDate: "2024-01-01",
				},
			],
		});
		const result = await generateNotes(
			{},
			context as Parameters<typeof generateNotes>[1],
		);
		expect(result).toBeDefined();
		expect(result).toContain("### Added");
		expect(result).toContain("**api**");
		expect(result).toContain("redesign API");
	});

	it("produces version header even with no commits", async () => {
		const context = makeContext({
			commits: [],
			nextRelease: { version: "1.0.0" },
			options: { repositoryUrl: "https://github.com/owner/repo.git" },
		});
		const result = await generateNotes(
			{},
			context as Parameters<typeof generateNotes>[1],
		);
		expect(result).toBeDefined();
		expect(result).toContain("1.0.0");
	});
});
