import { KAC_SECTIONS, OMITTED_TYPES, TYPE_TO_SECTION } from "./constants.js";

/**
 * Keep a Changelog writer configuration for conventional-changelog-writer.
 *
 * This provides:
 * - transform: maps commit types to KaC sections, omits irrelevant types,
 *   special-cases `chore(deps)` (Dependabot default) → Changed
 * - groupBy: groups by the mapped section name
 * - commitGroupsSort: sorts sections in KaC order
 * - commitsSort: sorts commits within a section by subject
 * - template / headerPartial / commitPartial / footerPartial: render functions
 *   (conventional-changelog-writer v9 replaced Handlebars templates with
 *   render functions)
 */

/** Minimal commit shape used by the render functions. */
interface RenderCommit {
	scope?: string;
	subject?: string;
}

/** Commit group with title and commits. */
export interface CommitGroup {
	title: string;
	commits: RenderCommit[];
}

/** Template context passed to render functions by the writer. */
interface RenderContext {
	version?: string;
	date?: string;
	commitGroups?: CommitGroup[];
	linkCompare?: boolean;
	host?: string;
	owner?: string;
	repository?: string;
	previousTag?: string | null;
	currentTag?: string | null;
	headerPartial: (ctx: RenderContext) => string;
	commitPartial: (ctx: RenderContext, commit: RenderCommit) => string;
}

export interface TransformedCommit {
	type: string;
	scope: string;
	subject: string;
	merge: boolean;
	header: string;
	body: string;
	footer: string;
	notes: unknown[];
	references: unknown[];
	mentions: string[];
	revert: boolean | null;
	hash: string;
	gitTags: string;
	committerDate: string;
	raw: {
		type: string;
		scope: string;
		subject: string;
		header: string;
		body: string;
		footer: string;
		notes: unknown[];
		references: unknown[];
		mentions: string[];
		merge: boolean;
		revert: boolean | null;
	};
	section?: string;
}

// Section sort order map for O(1) lookup
const sectionOrder: Map<string, number> = new Map(
	KAC_SECTIONS.map((section, index) => [section as string, index]),
);

export const writerOpts = {
	transform: (commit: TransformedCommit): Partial<TransformedCommit> | null => {
		// Map the commit type to a Keep a Changelog section
		let section = TYPE_TO_SECTION[commit.type];

		// Special case: Dependabot uses `chore(deps)` / `chore(deps-dev)` — map to Changed
		if (
			!section &&
			commit.type === "chore" &&
			commit.scope?.startsWith("deps")
		) {
			section = "Changed";
		}

		// Omit commits that don't map to any KaC section or are in the omitted set
		if (!section || (OMITTED_TYPES.has(commit.type) && section !== "Changed")) {
			return null;
		}

		// Return patch — writer v9 merges the diff into the original commit
		return {
			hash: commit.hash ? commit.hash.substring(0, 7) : commit.hash,
			section,
		};
	},
	groupBy: "section",
	commitGroupsSort: (a: CommitGroup, b: CommitGroup): number => {
		const aOrder = sectionOrder.get(a.title) ?? KAC_SECTIONS.length;
		const bOrder = sectionOrder.get(b.title) ?? KAC_SECTIONS.length;
		return aOrder - bOrder;
	},
	commitsSort: ["subject"],

	/** Renders the release header: `## [version] - date` */
	headerPartial: (ctx: RenderContext): string =>
		`## [${ctx.version}]${ctx.date ? ` - ${ctx.date}` : ""}`,

	/** Renders introductory text after the header (unused for KaC). */
	preamblePartial: (): string => "",

	/** Renders a single commit line: `- **scope**: subject` or `- subject`. */
	commitPartial: (_ctx: RenderContext, commit: RenderCommit): string =>
		`-${commit.scope ? ` **${commit.scope}**:` : ""} ${commit.subject}`,

	/** Renders release footer notes (unused for KaC). */
	footerPartial: (): string => "",

	/**
	 * Renders the full changelog entry: header, commit groups (with
	 * `### Section` headers), and an optional compare link.
	 */
	template: (ctx: RenderContext): string => {
		const blocks: string[] = [ctx.headerPartial(ctx)];

		for (const group of ctx.commitGroups ?? []) {
			const parts: string[] = [];
			if (group.title) {
				parts.push(`### ${group.title}`);
			}
			parts.push(
				group.commits
					.map((commit) => ctx.commitPartial(ctx, commit))
					.join("\n"),
			);
			blocks.push(parts.join("\n\n"));
		}

		if (ctx.linkCompare) {
			blocks.push(
				`[${ctx.version}]: ${ctx.host}/${ctx.owner}/${ctx.repository}/compare/${ctx.previousTag}...${ctx.currentTag}`,
			);
		}

		return blocks.join("\n\n");
	},
};
