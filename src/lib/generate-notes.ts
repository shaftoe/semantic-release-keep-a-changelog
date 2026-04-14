import { writeChangelogStream } from "conventional-changelog-writer";
import { filterRevertedCommitsSync } from "conventional-commits-filter";
import { CommitParser } from "conventional-commits-parser";
import getStream from "get-stream";
import intoStream from "into-stream";
import { Temporal } from "temporal-polyfill";
import { writerOpts } from "./keep-a-changelog.js";

/**
 * GitHub-specific configuration for parsing repository URLs and generating reference links.
 */
const GITHUB_CONFIG = {
	hostname: "github.com",
	issue: "issues",
	commit: "commit",
	referenceActions: [
		"close",
		"closes",
		"closed",
		"fix",
		"fixes",
		"fixed",
		"resolve",
		"resolves",
		"resolved",
	],
	issuePrefixes: ["#", "gh-"],
};

interface SemanticReleaseCommit {
	hash: string;
	message: string;
	committerDate: string;
}

interface Context {
	commits: SemanticReleaseCommit[];
	lastRelease: { gitTag?: string; gitHead?: string; version?: string };
	nextRelease: { gitTag?: string; gitHead?: string; version: string };
	options: { repositoryUrl: string };
	cwd: string;
}

/**
 * Generate release notes in Keep a Changelog format.
 *
 * Parses conventional commits, maps types to KaC sections,
 * and renders markdown via conventional-changelog-writer.
 * GitHub-only — no multi-host support.
 */
export async function generateNotes(
	_pluginConfig: Record<string, unknown>,
	context: Context,
): Promise<string> {
	const { commits, lastRelease, nextRelease, options } = context;
	const repositoryUrl = options.repositoryUrl.replace(/\.git$/i, "");

	// Parse repository URL to extract owner and repository
	// SSH URLs like `git@github.com:owner/repo.git` need rewriting to a
	// URL-parseable form; HTTPS URLs are parsed as-is.
	const sshMatch = /^(?!.+:\/\/)(?:([^@]+)@)?([^:]+):(.+)$/.exec(repositoryUrl);

	const url = new URL(
		sshMatch
			? `ssh://${sshMatch[1] ? `${sshMatch[1]}@` : ""}${sshMatch[2]}/${sshMatch[3]}`
			: repositoryUrl,
	);
	const { hostname, pathname } = url;
	const port = url.protocol.includes("ssh") ? "" : url.port;
	const protocol = url.protocol === "http:" ? "http" : "https";

	const [, owner, repository] = /^\/([^/]+)\/?(.+)?$/.exec(pathname) || [];

	const { issue, commit, referenceActions, issuePrefixes } = GITHUB_CONFIG;

	// Parse commits using conventional-commits-parser
	// Default headerPattern doesn't handle the `!` breaking change suffix (e.g. `feat!: ...`),
	// which causes the parser to produce type=undefined for such commits.
	const parser = new CommitParser({
		referenceActions,
		issuePrefixes,
		headerPattern: /^(\w*)(?:\(([\w$.* -]*)\))?!?: (.*)$/,
		headerCorrespondence: ["type", "scope", "subject"],
	});

	const parsedCommits = filterRevertedCommitsSync(
		commits
			.filter(({ message }) => message.trim())
			.map((rawCommit) => ({
				...rawCommit,
				...parser.parse(rawCommit.message),
			})),
	);

	const previousTag = lastRelease.gitTag || lastRelease.gitHead;
	const currentTag = nextRelease.gitTag || nextRelease.gitHead;

	const changelogContext: Record<string, unknown> = {
		version: nextRelease.version,
		date: Temporal.Now.plainDateISO().toString(),
		host: `${protocol}://${hostname}${port ? `:${port}` : ""}`,
		owner,
		repository,
		previousTag,
		currentTag,
		linkCompare: Boolean(currentTag && previousTag),
		issue,
		commit,
	};

	// Render through conventional-changelog-writer with our Keep a Changelog templates
	return getStream(
		intoStream
			.object(parsedCommits)
			// biome-ignore lint/suspicious/noExplicitAny: third-party types are untyped
			.pipe(writeChangelogStream(changelogContext as any, writerOpts as any)),
	);
}
