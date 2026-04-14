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
 * - mainTemplate / headerPartial / commitPartial: Handlebars templates
 */

export interface CommitGroup {
	title: string;
	commits: unknown[];
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
	transform: (commit: TransformedCommit): TransformedCommit | null => {
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

		// Limit hash to 7 characters — return a new object since writer v8 freezes input
		return {
			...commit,
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
	mainTemplate: `{{> header}}\n\n{{#each commitGroups~}}{{#if title}}\n### {{title}}\n\n{{/if}}{{#each commits}}{{> commit root=@root}}{{/each}}{{/each~}}{{#if @root.linkCompare}}\n[{{@root.version}}]: {{@root.host}}/{{@root.owner}}/{{@root.repository}}/compare/{{@root.previousTag}}...{{@root.currentTag}}{{/if}}`,
	headerPartial: `## [{{version}}]{{#if date}} - {{date}}{{/if}}`,
	commitPartial: `-{{#if scope}} **{{scope}}**:{{/if}} {{subject}}\n`,
	footerPartial: "",
};
