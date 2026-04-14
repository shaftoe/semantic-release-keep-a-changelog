import { describe, expect, it } from "bun:test";
import type { TransformedCommit } from "../src/lib/keep-a-changelog.js";
import { writerOpts } from "../src/lib/keep-a-changelog.js";

function makeCommit(
	overrides: Partial<TransformedCommit> = {},
): TransformedCommit {
	return {
		type: "feat",
		scope: "",
		subject: "add feature",
		merge: false,
		header: "feat: add feature",
		body: "",
		footer: "",
		notes: [],
		references: [],
		mentions: [],
		revert: null,
		hash: "abc123def456",
		gitTags: "",
		committerDate: "2024-01-01",
		raw: {
			type: "feat",
			scope: "",
			subject: "add feature",
			header: "feat: add feature",
			body: "",
			footer: "",
			notes: [],
			references: [],
			mentions: [],
			merge: false,
			revert: null,
		},
		...overrides,
	};
}

describe("writerOpts.transform", () => {
	it("maps feat to Added", () => {
		const result = writerOpts.transform(makeCommit({ type: "feat" }));
		expect(result).not.toBeNull();
		expect(result?.section).toBe("Added");
	});

	it("maps fix to Fixed", () => {
		const result = writerOpts.transform(makeCommit({ type: "fix" }));
		expect(result).not.toBeNull();
		expect(result?.section).toBe("Fixed");
	});

	it("maps perf to Changed", () => {
		const result = writerOpts.transform(makeCommit({ type: "perf" }));
		expect(result).not.toBeNull();
		expect(result?.section).toBe("Changed");
	});

	it("maps refactor to Changed", () => {
		const result = writerOpts.transform(makeCommit({ type: "refactor" }));
		expect(result).not.toBeNull();
		expect(result?.section).toBe("Changed");
	});

	it("maps revert to Removed", () => {
		const result = writerOpts.transform(makeCommit({ type: "revert" }));
		expect(result).not.toBeNull();
		expect(result?.section).toBe("Removed");
	});

	it("maps docs to Changed", () => {
		const result = writerOpts.transform(makeCommit({ type: "docs" }));
		expect(result).not.toBeNull();
		expect(result?.section).toBe("Changed");
	});

	it("maps style to Changed", () => {
		const result = writerOpts.transform(makeCommit({ type: "style" }));
		expect(result).not.toBeNull();
		expect(result?.section).toBe("Changed");
	});

	it("maps chore(deps) to Changed (Dependabot)", () => {
		const result = writerOpts.transform(
			makeCommit({ type: "chore", scope: "deps" }),
		);
		expect(result).not.toBeNull();
		expect(result?.section).toBe("Changed");
	});

	it("maps chore(deps-dev) to Changed (Dependabot dev deps)", () => {
		const result = writerOpts.transform(
			makeCommit({ type: "chore", scope: "deps-dev" }),
		);
		expect(result).not.toBeNull();
		expect(result?.section).toBe("Changed");
	});

	it("omits test type", () => {
		const result = writerOpts.transform(makeCommit({ type: "test" }));
		expect(result).toBeNull();
	});

	it("omits ci type", () => {
		const result = writerOpts.transform(makeCommit({ type: "ci" }));
		expect(result).toBeNull();
	});

	it("omits build type", () => {
		const result = writerOpts.transform(makeCommit({ type: "build" }));
		expect(result).toBeNull();
	});

	it("omits chore without deps scope", () => {
		const result = writerOpts.transform(
			makeCommit({ type: "chore", scope: "linting" }),
		);
		expect(result).toBeNull();
	});

	it("truncates hash to 7 characters", () => {
		const result = writerOpts.transform(
			makeCommit({ hash: "abc123def456789" }),
		);
		expect(result).not.toBeNull();
		expect(result?.hash).toBe("abc123d");
	});

	it("preserves empty hash", () => {
		const result = writerOpts.transform(makeCommit({ hash: "" }));
		expect(result).not.toBeNull();
		expect(result?.hash).toBe("");
	});

	it("returns a new object (not same reference)", () => {
		const commit = makeCommit();
		const result = writerOpts.transform(commit);
		expect(result).not.toBe(commit);
	});
});

describe("writerOpts config", () => {
	it("groups by section", () => {
		expect(writerOpts.groupBy).toBe("section");
	});

	it("sorts commits by subject", () => {
		expect(writerOpts.commitsSort).toEqual(["subject"]);
	});

	it("sorts commit groups in KaC order", () => {
		const sort = writerOpts.commitGroupsSort;
		// Added (0) < Fixed (4)
		expect(
			sort({ title: "Added", commits: [] }, { title: "Fixed", commits: [] }),
		).toBeLessThan(0);
		// Fixed (4) > Added (0)
		expect(
			sort({ title: "Fixed", commits: [] }, { title: "Added", commits: [] }),
		).toBeGreaterThan(0);
		// Unknown sections sort last
		expect(
			sort({ title: "Unknown", commits: [] }, { title: "Added", commits: [] }),
		).toBeGreaterThan(0);
	});
});
