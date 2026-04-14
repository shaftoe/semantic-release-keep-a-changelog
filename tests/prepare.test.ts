import { describe, expect, it } from "bun:test";
import {
	access,
	mkdir,
	mkdtemp,
	readFile,
	rm,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { insertReleaseNotes, prepare } from "../src/lib/prepare.js";

async function makeTmpDir(): Promise<string> {
	return mkdtemp(join(tmpdir(), "kac-test-"));
}

async function makeContext(overrides: Record<string, unknown> = {}) {
	// Returns a function that creates a fresh tmp dir + context
	const dir = await mkdtemp(join(tmpdir(), "kac-test-"));
	return {
		dir,
		context: {
			cwd: dir,
			nextRelease: {
				notes: "## 1.0.0\n\n### Added\n- new feature" as string | undefined,
			},
			logger: { log: () => {} },
			...overrides,
		} as Parameters<typeof prepare>[1],
	};
}

describe("insertReleaseNotes", () => {
	it("prepends at top when no [Unreleased] section", () => {
		const result = insertReleaseNotes(
			"## [0.9.0]\n\n### Fixed\n- bug fix",
			"## [1.0.0]\n\n### Added\n- new feature",
		);
		expect(result).toContain("## [1.0.0]");
		expect(result).toContain("## [0.9.0]");
		const newIdx = result.indexOf("## [1.0.0]");
		const oldIdx = result.indexOf("## [0.9.0]");
		expect(newIdx).toBeLessThan(oldIdx);
	});

	it("inserts after [Unreleased] with no content and no following version", () => {
		const result = insertReleaseNotes(
			"## [Unreleased]",
			"## [1.0.0]\n\n### Added\n- feature",
		);
		const unreleasedIdx = result.indexOf("## [Unreleased]");
		const newIdx = result.indexOf("## [1.0.0]");
		expect(unreleasedIdx).toBeGreaterThanOrEqual(0);
		expect(newIdx).toBeGreaterThan(unreleasedIdx);
	});

	it("inserts after [Unreleased] with content but no following version", () => {
		const result = insertReleaseNotes(
			"## [Unreleased]\n\n### Changed\n- some change",
			"## [1.0.0]\n\n### Added\n- feature",
		);
		const unreleasedIdx = result.indexOf("## [Unreleased]");
		const newIdx = result.indexOf("## [1.0.0]");
		expect(unreleasedIdx).toBeGreaterThanOrEqual(0);
		expect(newIdx).toBeGreaterThan(unreleasedIdx);
		expect(result).toContain("some change");
		expect(result).toContain("feature");
	});

	it("inserts between [Unreleased] and existing version", () => {
		const result = insertReleaseNotes(
			"## [Unreleased]\n\n### Changed\n- wip\n\n## [0.9.0]\n\n### Fixed\n- bug",
			"## [1.0.0]\n\n### Added\n- feature",
		);
		const unreleasedIdx = result.indexOf("## [Unreleased]");
		const newIdx = result.indexOf("## [1.0.0]");
		const oldIdx = result.indexOf("## [0.9.0]");
		expect(unreleasedIdx).toBeGreaterThanOrEqual(0);
		expect(newIdx).toBeGreaterThan(unreleasedIdx);
		expect(oldIdx).toBeGreaterThan(newIdx);
		expect(result).toContain("wip");
		expect(result).toContain("feature");
		expect(result).toContain("bug");
	});

	it("handles [Unreleased] with content before first existing version", () => {
		const result = insertReleaseNotes(
			"## [Unreleased]\n\n### Added\n\n- upcoming feature",
			"## [1.0.0]\n\n### Fixed\n- patch",
		);
		const unreleasedIdx = result.indexOf("## [Unreleased]");
		const newIdx = result.indexOf("## [1.0.0]");
		expect(unreleasedIdx).toBeGreaterThanOrEqual(0);
		expect(newIdx).toBeGreaterThan(unreleasedIdx);
		expect(result).toContain("upcoming feature");
		expect(result).toContain("patch");
	});

	it("returns notes only when file body is empty", () => {
		const result = insertReleaseNotes("", "## [1.0.0]\n\n### Added\n- feature");
		expect(result).toContain("## [1.0.0]");
		expect(result).toContain("feature");
	});
});

describe("prepare", () => {
	it("creates a new changelog file when none exists", async () => {
		const { dir, context } = await makeContext();
		try {
			await prepare({}, context);
			const content = await readFile(join(dir, "CHANGELOG.md"), "utf-8");
			expect(content).toContain("## 1.0.0");
			expect(content).toContain("### Added");
			expect(content).toContain("new feature");
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("prepends new notes above existing content", async () => {
		const { dir, context } = await makeContext();
		try {
			await mkdir(join(dir), { recursive: true });
			await writeFile(
				join(dir, "CHANGELOG.md"),
				"## 0.9.0\n\n### Fixed\n- bug fix",
				"utf-8",
			);

			await prepare({}, context);
			const content = await readFile(join(dir, "CHANGELOG.md"), "utf-8");
			const newIdx = content.indexOf("## 1.0.0");
			const oldIdx = content.indexOf("## 0.9.0");
			expect(newIdx).toBeLessThan(oldIdx);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("strips existing title header when updating", async () => {
		const { dir, context } = await makeContext();
		try {
			const { CHANGELOG_TITLE } = await import("../src/lib/constants.js");
			await mkdir(join(dir), { recursive: true });
			await writeFile(
				join(dir, "CHANGELOG.md"),
				`${CHANGELOG_TITLE}\n\n## 0.9.0\n\n### Fixed\n- bug fix`,
				"utf-8",
			);

			await prepare({}, context);
			const content = await readFile(join(dir, "CHANGELOG.md"), "utf-8");
			const firstIdx = content.indexOf(CHANGELOG_TITLE);
			const secondIdx = content.indexOf(CHANGELOG_TITLE, firstIdx + 1);
			expect(firstIdx).toBeGreaterThanOrEqual(0);
			expect(secondIdx).toBe(-1);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("does not write when notes is undefined", async () => {
		const dir = await makeTmpDir();
		const context = {
			cwd: dir,
			nextRelease: { notes: undefined },
			logger: { log: () => {} },
		};
		try {
			await prepare({}, context as Parameters<typeof prepare>[1]);
			await expect(access(join(dir, "CHANGELOG.md"))).rejects.toThrow();
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("uses custom changelogFile", async () => {
		const dir = await makeTmpDir();
		const context = {
			cwd: dir,
			nextRelease: { notes: "## 2.0.0\n\n### Removed\n- old api" },
			logger: { log: () => {} },
		};
		try {
			await prepare(
				{ changelogFile: "HISTORY.md" },
				context as Parameters<typeof prepare>[1],
			);
			const content = await readFile(join(dir, "HISTORY.md"), "utf-8");
			expect(content).toContain("## 2.0.0");
			expect(content).toContain("### Removed");
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("uses custom changelogTitle", async () => {
		const dir = await makeTmpDir();
		const context = {
			cwd: dir,
			nextRelease: { notes: "## 1.0.0\n\n### Added\n- feature" },
			logger: { log: () => {} },
		};
		try {
			await prepare(
				{ changelogTitle: "# My Custom Title" },
				context as Parameters<typeof prepare>[1],
			);
			const content = await readFile(join(dir, "CHANGELOG.md"), "utf-8");
			expect(content.startsWith("# My Custom Title")).toBe(true);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("appends after [Unreleased] with no newline after it", async () => {
		const dir = await makeTmpDir();
		const context = {
			cwd: dir,
			nextRelease: { notes: "## 1.0.0\n\n### Added\n- new feature" },
			logger: { log: () => {} },
		};
		try {
			await mkdir(join(dir), { recursive: true });
			await writeFile(join(dir, "CHANGELOG.md"), "## [Unreleased]", "utf-8");

			await prepare({}, context as Parameters<typeof prepare>[1]);
			const content = await readFile(join(dir, "CHANGELOG.md"), "utf-8");
			const unreleasedIdx = content.indexOf("## [Unreleased]");
			const newReleaseIdx = content.indexOf("## 1.0.0");
			expect(unreleasedIdx).toBeGreaterThanOrEqual(0);
			expect(newReleaseIdx).toBeGreaterThan(unreleasedIdx);
			expect(content).toContain("new feature");
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("appends after [Unreleased] with newline but no following version", async () => {
		const dir = await makeTmpDir();
		const context = {
			cwd: dir,
			nextRelease: { notes: "## 1.0.0\n\n### Added\n- new feature" },
			logger: { log: () => {} },
		};
		try {
			await mkdir(join(dir), { recursive: true });
			await writeFile(
				join(dir, "CHANGELOG.md"),
				"## [Unreleased]\n\n### Changed\n- some change",
				"utf-8",
			);

			await prepare({}, context as Parameters<typeof prepare>[1]);
			const content = await readFile(join(dir, "CHANGELOG.md"), "utf-8");
			const unreleasedIdx = content.indexOf("## [Unreleased]");
			const newReleaseIdx = content.indexOf("## 1.0.0");
			expect(unreleasedIdx).toBeGreaterThanOrEqual(0);
			expect(newReleaseIdx).toBeGreaterThan(unreleasedIdx);
			expect(content).toContain("some change");
			expect(content).toContain("new feature");
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("ends file with single newline", async () => {
		const dir = await makeTmpDir();
		const context = {
			cwd: dir,
			nextRelease: {
				notes: "## 1.0.0\n\n### Added\n- new feature",
			},
			logger: { log: () => {} },
		};
		try {
			await prepare({}, context as Parameters<typeof prepare>[1]);
			const content = await readFile(join(dir, "CHANGELOG.md"), "utf-8");
			expect(content.endsWith("\n")).toBe(true);
			expect(content.endsWith("\n\n")).toBe(false);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("manages footer links: adds [unreleased] when [Unreleased] section exists", async () => {
		const dir = await makeTmpDir();
		try {
			await mkdir(join(dir), { recursive: true });

			// Seed file with [Unreleased] section and first release
			await writeFile(
				join(dir, "CHANGELOG.md"),
				"## [Unreleased]\n\n## [1.0.0] - 2024-01-01\n\n### Added\n\n- initial feature\n\n[unreleased]: https://github.com/acme/app/compare/v1.0.0...HEAD\n[1.0.0]: https://github.com/acme/app/releases/tag/v1.0.0",
				"utf-8",
			);

			await prepare({}, {
				cwd: dir,
				nextRelease: {
					notes:
						"## [1.1.0] - 2024-02-01\n\n### Added\n\n- second feature\n\n[1.1.0]: https://github.com/acme/app/compare/v1.0.0...v1.1.0\n",
				},
				logger: { log: () => {} },
			} as Parameters<typeof prepare>[1]);

			const content = await readFile(join(dir, "CHANGELOG.md"), "utf-8");

			// Footer should have [unreleased] pointing to v1.1.0...HEAD (updated)
			expect(content).toContain(
				"[unreleased]: https://github.com/acme/app/compare/v1.1.0...HEAD",
			);
			expect(content).toContain(
				"[1.1.0]: https://github.com/acme/app/compare/v1.0.0...v1.1.0",
			);

			// [unreleased] should appear before the release links
			const unreleasedLinkIdx = content.indexOf("[unreleased]:");
			const v110LinkIdx = content.indexOf("[1.1.0]:");
			expect(unreleasedLinkIdx).toBeLessThan(v110LinkIdx);

			// Old [unreleased] URL should be gone
			expect(content).not.toContain(
				"[unreleased]: https://github.com/acme/app/compare/v1.0.0...HEAD",
			);

			// No version header should appear after the link footer
			const afterFirstLink = content.slice(content.indexOf("[unreleased]:"));
			expect(afterFirstLink).not.toContain("## [");

			// File ends with single newline
			expect(content.endsWith("\n")).toBe(true);
			expect(content.endsWith("\n\n")).toBe(false);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("manages footer links: updates [unreleased] on third release", async () => {
		const dir = await makeTmpDir();
		try {
			await mkdir(join(dir), { recursive: true });

			// Seed file with existing releases and links
			await writeFile(
				join(dir, "CHANGELOG.md"),
				"## [1.1.0] - 2024-02-01\n\n### Added\n\n- second feature\n\n## [1.0.0] - 2024-01-01\n\n### Added\n\n- initial feature\n\n[unreleased]: https://github.com/acme/app/compare/v1.1.0...HEAD\n[1.1.0]: https://github.com/acme/app/compare/v1.0.0...v1.1.0\n[1.0.0]: https://github.com/acme/app/releases/tag/v1.0.0",
				"utf-8",
			);

			await prepare({}, {
				cwd: dir,
				nextRelease: {
					notes:
						"## [2.0.0] - 2024-03-01\n\n### Removed\n\n- old api\n\n[2.0.0]: https://github.com/acme/app/compare/v1.1.0...v2.0.0\n",
				},
				logger: { log: () => {} },
			} as Parameters<typeof prepare>[1]);

			const content = await readFile(join(dir, "CHANGELOG.md"), "utf-8");

			// [unreleased] should now point to v2.0.0...HEAD
			expect(content).toContain(
				"[unreleased]: https://github.com/acme/app/compare/v2.0.0...HEAD",
			);
			// Old [unreleased] link should be gone
			expect(content).not.toContain(
				"[unreleased]: https://github.com/acme/app/compare/v1.1.0...HEAD",
			);

			// Footer links in order: unreleased, 2.0.0, 1.1.0, 1.0.0
			const lines = content.split("\n");
			const footerStart = lines.findIndex((l) => l.startsWith("[unreleased]:"));
			expect(lines[footerStart]).toBe(
				"[unreleased]: https://github.com/acme/app/compare/v2.0.0...HEAD",
			);
			expect(lines[footerStart + 1]).toBe(
				"[2.0.0]: https://github.com/acme/app/compare/v1.1.0...v2.0.0",
			);
			expect(lines[footerStart + 2]).toBe(
				"[1.1.0]: https://github.com/acme/app/compare/v1.0.0...v1.1.0",
			);
			expect(lines[footerStart + 3]).toBe(
				"[1.0.0]: https://github.com/acme/app/releases/tag/v1.0.0",
			);

			// No extra links after footer
			expect(lines[footerStart + 4]).toBe("");
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("preserves existing links when new release has no compare link", async () => {
		const dir = await makeTmpDir();
		try {
			await mkdir(join(dir), { recursive: true });

			// Seed with existing links
			await writeFile(
				join(dir, "CHANGELOG.md"),
				"## [1.0.0] - 2024-01-01\n\n### Added\n\n- initial feature\n\n[1.0.0]: https://github.com/acme/app/releases/tag/v1.0.0",
				"utf-8",
			);

			await prepare({}, {
				cwd: dir,
				nextRelease: {
					notes: "## [1.1.0] - 2024-02-01\n\n### Added\n\n- new feature\n",
				},
				logger: { log: () => {} },
			} as Parameters<typeof prepare>[1]);

			const content = await readFile(join(dir, "CHANGELOG.md"), "utf-8");

			// No compare link in notes → no [unreleased] link generated
			expect(content).not.toContain("[unreleased]:");

			// Existing link should be preserved
			expect(content).toContain(
				"[1.0.0]: https://github.com/acme/app/releases/tag/v1.0.0",
			);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});
});
