// Default title block for the changelog file
export const CHANGELOG_TITLE = `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).`;

// Default changelog file path
export const DEFAULT_CHANGELOG_FILE = "CHANGELOG.md";

// Keep a Changelog section order
export const KAC_SECTIONS = [
	"Added",
	"Changed",
	"Deprecated",
	"Removed",
	"Fixed",
] as const;

// Type mapping: conventional commit type → Keep a Changelog section
export const TYPE_TO_SECTION: Record<string, string> = {
	feat: "Added",
	fix: "Fixed",
	perf: "Changed",
	refactor: "Changed",
	revert: "Removed",
	docs: "Changed",
	style: "Changed",
};

// Commit types to silently omit from the changelog
export const OMITTED_TYPES = new Set(["test", "ci", "build", "chore"]);
