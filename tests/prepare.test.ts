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
import { prepare } from "../src/lib/prepare.js";

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
});
