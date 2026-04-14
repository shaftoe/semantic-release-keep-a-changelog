import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { CHANGELOG_TITLE, DEFAULT_CHANGELOG_FILE } from "./constants.js";

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

interface LinkDef {
	label: string;
	url: string;
}

/**
 * Extract link definition lines from the tail of a markdown string.
 * Returns the body (without links) and the link definitions in order.
 */
function extractFooterLinks(text: string): { body: string; links: LinkDef[] } {
	const lines = text.split("\n");
	const links: LinkDef[] = [];

	// Walk backwards from the end collecting link definition lines
	let i = lines.length - 1;

	// Skip trailing empty lines
	while (i >= 0 && lines[i] === "") {
		i--;
	}

	while (i >= 0) {
		const line = lines[i];
		const match = line.match(/^\[([^\]]+)\]:\s+(https?:\/\/.+)$/);
		if (match) {
			links.unshift({ label: match[1], url: match[2] });
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
 * Build the footer link definitions for a Keep a Changelog file.
 *
 * Footer format (newest first):
 *   [unreleased]: repo/compare/vLATEST...HEAD
 *   [1.2.0]:      repo/compare/v1.1.0...v1.2.0
 *   [1.1.0]:      repo/compare/v1.0.0...v1.1.0
 *   ...
 *
 * The [unreleased] link is derived from the new release's compare URL
 * and always points from the latest release tag to HEAD.
 */
function buildFooter(newLinks: LinkDef[], existingLinks: LinkDef[]): LinkDef[] {
	// Find the new release compare link (skip any [unreleased] in notes)
	const newReleaseLink = newLinks.find(
		(l) => l.label.toLowerCase() !== "unreleased",
	);

	const footer: LinkDef[] = [];

	// Derive [unreleased] link from the new release's compare URL,
	// but only if an [unreleased] link already existed (i.e. there's an
	// ## [Unreleased] section in the file that references it)
	const hasUnreleasedSection = existingLinks.some(
		(l) => l.label.toLowerCase() === "unreleased",
	);
	if (newReleaseLink && hasUnreleasedSection) {
		const unreleasedUrl = newReleaseLink.url.replace(
			/\/compare\/.+$/,
			`/compare/v${newReleaseLink.label}...HEAD`,
		);
		footer.push({ label: "unreleased", url: unreleasedUrl });
	}

	// New release link
	if (newReleaseLink) {
		footer.push(newReleaseLink);
	}

	// Existing links (skip old [unreleased] — we just rebuilt it above)
	for (const link of existingLinks) {
		if (link.label.toLowerCase() === "unreleased") continue;
		if (newReleaseLink && link.label === newReleaseLink.label) continue;
		footer.push(link);
	}

	return footer;
}

/**
 * Insert new release notes into the existing changelog body.
 *
 * If an [Unreleased] section exists, inserts the new release AFTER it
 * and BEFORE the previous release. Otherwise, prepends at the top.
 */
export function insertReleaseNotes(
	fileBody: string,
	notesBody: string,
): string {
	const unreleasedPos = findVersionHeader(fileBody, "Unreleased");

	if (unreleasedPos !== -1) {
		// Find the next version header after [Unreleased]
		const afterUnreleased = fileBody.slice(unreleasedPos);
		const firstNewline = afterUnreleased.indexOf("\n");
		if (firstNewline === -1) {
			// Unreleased is the only version, append at end
			return `${fileBody}\n\n${notesBody}\n`;
		}

		const afterFirstLine = afterUnreleased.slice(firstNewline);
		const nextVersionMatch = afterFirstLine.match(/^##\s*\[/m);

		if (nextVersionMatch) {
			// Insert between [Unreleased] and the next version
			const insertPos =
				unreleasedPos + firstNewline + (nextVersionMatch.index ?? 0);
			const betweenSections = fileBody.slice(unreleasedPos, insertPos);
			const cleanBetween = betweenSections.replace(/\n+$/, "");
			return `${cleanBetween}\n\n${notesBody}\n\n${fileBody.slice(insertPos)}`;
		}
		// No next version after [Unreleased], append at end
		return `${fileBody}\n\n${notesBody}\n`;
	}

	// No [Unreleased] section, prepend at top
	return `${notesBody}\n${fileBody ? `\n${fileBody}\n` : ""}`;
}

/**
 * Merge generated release notes into the existing CHANGELOG.md.
 *
 * If an [Unreleased] section exists, inserts the new release notes
 * AFTER the [Unreleased] section and BEFORE the previous release.
 * Otherwise, prepends at the top (new file behavior).
 *
 * The footer of link definitions is fully managed:
 *   [unreleased]: repo/compare/vLATEST...HEAD   (always rolling)
 *   [X.Y.Z]:      repo/compare/vPREV...vX.Y.Z   (one per release)
 */
export async function prepare(
	_pluginConfig: Record<string, unknown>,
	{ cwd, nextRelease: { notes }, logger }: PrepareContext,
): Promise<void> {
	const changelogPath = resolve(cwd, DEFAULT_CHANGELOG_FILE);
	const changelogTitle = CHANGELOG_TITLE;

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

		// Separate notes body from any link definitions generated by the writer
		const { body: notesBody, links: notesLinks } = extractFooterLinks(notes);

		// Extract existing footer links from the file
		const { body: fileBody, links: existingLinks } =
			extractFooterLinks(currentContent);

		let content = insertReleaseNotes(fileBody, notesBody);

		// Build the managed footer and append it
		content = content.trimEnd();
		const footer = buildFooter(notesLinks, existingLinks);
		if (footer.length > 0) {
			const footerLines = footer.map((l) => `[${l.label}]: ${l.url}`);
			content = `${content}\n\n${footerLines.join("\n")}\n`;
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
