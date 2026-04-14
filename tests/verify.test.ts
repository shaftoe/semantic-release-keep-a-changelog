import { describe, expect, it } from "bun:test";
import { verifyConditions } from "../src/lib/verify.js";

describe("verifyConditions", () => {
	it("passes with empty config", () => {
		expect(() => verifyConditions()).not.toThrow();
	});

	it("passes with empty object", () => {
		expect(() => verifyConditions({})).not.toThrow();
	});

	it("passes with valid string options", () => {
		expect(() =>
			verifyConditions({
				changelogFile: "CHANGELOG.md",
				changelogTitle: "# My Changelog",
			}),
		).not.toThrow();
	});

	it("passes with only valid changelogFile", () => {
		expect(() =>
			verifyConditions({ changelogFile: "HISTORY.md" }),
		).not.toThrow();
	});

	it("throws for non-string changelogFile", () => {
		expect(() => verifyConditions({ changelogFile: 123 })).toThrow();
	});

	it("throws for empty-string changelogTitle", () => {
		expect(() => verifyConditions({ changelogTitle: "" })).toThrow();
	});

	it("throws for whitespace-only changelogTitle", () => {
		expect(() => verifyConditions({ changelogTitle: "   " })).toThrow();
	});

	it("throws for whitespace-only changelogFile", () => {
		expect(() => verifyConditions({ changelogFile: "   " })).toThrow();
	});

	it("throws AggregateError with multiple errors when both options are invalid", () => {
		try {
			verifyConditions({ changelogFile: 123, changelogTitle: "" });
		} catch (error: unknown) {
			expect(error).toBeInstanceOf(Error);
			expect((error as Error).name).toBe("AggregateError");
		}
	});
});
