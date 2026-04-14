import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { resolveConfig } from "./resolve-config.js";

interface PrepareContext {
	cwd: string;
	nextRelease: { notes?: string };
	logger: { log: (message: string) => void };
}

async function ensureFile(filePath: string): Promise<void> {
	await mkdir(dirname(filePath), { recursive: true });
	// Create the file if it doesn't exist
	try {
		await writeFile(filePath, "", { flag: "wx" });
	} catch {
		// File already exists, that's fine
	}
}

/**
 * Find the position of a version header (e.g., "## [1.0.0]" or "## [Unreleased]").
 * Returns the index of the start of the line, or -1 if not found.
 */
function findVersionHeader(content: string, version: string): number {
	// Match "## [version]" at the beginning of a line
	const regex = new RegExp(`^##\\s*\\[${escapeRegex(version)}\\]`, "m");
	const match = content.match(regex);
	return match?.index ?? -1;
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(string: string): string {
	return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Extract link definition lines from the end of the notes.
 * Link definitions match: [version]: URL
 */
function extractLinkLines(notes: string): { body: string; links: string[] } {
	const lines = notes.split("\n");
	const links: string[] = [];

	// Walk backwards from the end collecting link definition lines
	let i = lines.length - 1;
	while (i >= 0) {
		const line = lines[i];
		if (/^\[[^\]]+\]:\s+https?:\/\/.+/.test(line)) {
			links.unshift(line);
			i--;
		} else if (line === "" && links.length > 0) {
			// Skip blank lines between link definitions and body
			i--;
		} else {
			break;
		}
	}

	const body = lines
		.slice(0, i + 1)
		.join("\n")
		.trimEnd();
	return { body, links };
}

/**
 * Merge generated release notes into the existing CHANGELOG.md.
 *
 * If an [Unreleased] section exists, inserts the new release notes
 * AFTER the [Unreleased] section and BEFORE the previous release.
 * Otherwise, prepends at the top (new file behavior).
 *
 * Link definition lines (e.g. [1.0.0]: https://...compare/v0.9.0...v1.0.0)
 * are always placed at the very end of the file.
 */
export async function prepare(
	pluginConfig: Record<string, unknown>,
	{ cwd, nextRelease: { notes }, logger }: PrepareContext,
): Promise<void> {
	const { changelogFile, changelogTitle } = resolveConfig(pluginConfig);
	const changelogPath = resolve(cwd, changelogFile);

	if (notes) {
		await ensureFile(changelogPath);

		let currentFile = "";
		try {
			currentFile = (await readFile(changelogPath, "utf-8")).trim();
		} catch {
			// File doesn't exist yet, that's fine
		}

		if (currentFile) {
			logger.log(`Update ${changelogPath}`);
		} else {
			logger.log(`Create ${changelogPath}`);
		}

		// Strip the title header from existing content if present
		const currentContent =
			changelogTitle && currentFile.startsWith(changelogTitle)
				? currentFile.slice(changelogTitle.length).trim()
				: currentFile;

		// Separate the release notes body from link definition lines
		const { body: notesBody, links: newLinks } = extractLinkLines(notes);

		let content: string;

		// Check if there's an [Unreleased] section
		const unreleasedPos = findVersionHeader(currentContent, "Unreleased");

		if (unreleasedPos !== -1) {
			// Find the next section after [Unreleased]
			// Look for the next "## [" after the first line (which is [Unreleased] itself)
			const afterUnreleased = currentContent.slice(unreleasedPos);
			// Find the first newline to skip past the "## [Unreleased]" line
			const firstNewline = afterUnreleased.indexOf("\n");
			if (firstNewline === -1) {
				// Unreleased is the only version, append at end
				content = `${currentContent}\n\n${notesBody}\n`;
			} else {
				// Search for next version header AFTER the Unreleased line
				const afterFirstLine = afterUnreleased.slice(firstNewline);
				const nextVersionMatch = afterFirstLine.match(/^##\s*\[/m);

				if (nextVersionMatch) {
					// Insert after [Unreleased] section, before next version
					const insertPos =
						unreleasedPos + firstNewline + (nextVersionMatch.index ?? 0);
					// Extract content between Unreleased and next version to check spacing
					const betweenSection = currentContent.slice(unreleasedPos, insertPos);
					// Remove trailing newlines from the Unreleased section content
					const cleanBetween = betweenSection.replace(/\n+$/, "");
					content = `${cleanBetween}\n\n${notesBody}\n\n${currentContent.slice(insertPos)}`;
				} else {
					// No next version found, append at end
					content = `${currentContent}\n\n${notesBody}\n`;
				}
			}
		} else {
			// No [Unreleased] section, prepend at top
			content = `${notesBody}\n${currentContent ? `\n${currentContent}\n` : ""}`;
		}

		// Append link definitions at the very end of the file
		content = content.trimEnd();
		if (newLinks.length > 0) {
			content = `${content}\n\n${newLinks.join("\n")}\n`;
		} else {
			content = `${content}\n`;
		}

		// Write with title header prepended
		await writeFile(
			changelogPath,
			changelogTitle ? `${changelogTitle}\n\n${content}` : content,
			"utf-8",
		);
	}
}
