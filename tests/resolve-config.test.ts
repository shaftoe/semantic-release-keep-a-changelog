import { describe, expect, it } from "bun:test";
import {
	CHANGELOG_TITLE,
	DEFAULT_CHANGELOG_FILE,
} from "../src/lib/constants.js";
import { resolveConfig } from "../src/lib/resolve-config.js";

describe("resolveConfig", () => {
	it("returns defaults when no config is provided", () => {
		const result = resolveConfig();
		expect(result.changelogFile).toBe(DEFAULT_CHANGELOG_FILE);
		expect(result.changelogTitle).toBe(CHANGELOG_TITLE);
	});

	it("returns defaults when empty object is provided", () => {
		const result = resolveConfig({});
		expect(result.changelogFile).toBe(DEFAULT_CHANGELOG_FILE);
		expect(result.changelogTitle).toBe(CHANGELOG_TITLE);
	});

	it("uses custom changelogFile", () => {
		const result = resolveConfig({ changelogFile: "HISTORY.md" });
		expect(result.changelogFile).toBe("HISTORY.md");
		expect(result.changelogTitle).toBe(CHANGELOG_TITLE);
	});

	it("uses custom changelogTitle", () => {
		const result = resolveConfig({ changelogTitle: "# My Changelog" });
		expect(result.changelogFile).toBe(DEFAULT_CHANGELOG_FILE);
		expect(result.changelogTitle).toBe("# My Changelog");
	});

	it("uses both custom values", () => {
		const result = resolveConfig({
			changelogFile: "HISTORY.md",
			changelogTitle: "# My Changelog",
		});
		expect(result.changelogFile).toBe("HISTORY.md");
		expect(result.changelogTitle).toBe("# My Changelog");
	});

	it("falls back to default changelogFile when empty string is provided", () => {
		const result = resolveConfig({ changelogFile: "" });
		expect(result.changelogFile).toBe(DEFAULT_CHANGELOG_FILE);
	});

	it("falls back to default changelogTitle when null is provided", () => {
		const result = resolveConfig({ changelogTitle: null });
		expect(result.changelogTitle).toBe(CHANGELOG_TITLE);
	});

	it("falls back to default changelogTitle when undefined is provided", () => {
		const result = resolveConfig({ changelogTitle: undefined });
		expect(result.changelogTitle).toBe(CHANGELOG_TITLE);
	});
});
