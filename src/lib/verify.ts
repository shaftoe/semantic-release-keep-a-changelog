import AggregateErrorPkg from "aggregate-error";
import { isNil, isString } from "lodash-es";

const isNonEmptyString = (value: unknown): value is string =>
	isString(value) && value.trim().length > 0;

interface Validators {
	changelogFile: typeof isNonEmptyString;
	changelogTitle: typeof isNonEmptyString;
}

const VALIDATORS: Validators = {
	changelogFile: isNonEmptyString,
	changelogTitle: isNonEmptyString,
};

/**
 * Validate plugin configuration.
 */
const CONFIG_KEYS = ["changelogFile", "changelogTitle"] as const;

export function verifyConditions(
	pluginConfig: Record<string, unknown> = {},
): void {
	const errors: Error[] = [];

	// Validate raw user input for explicitly-provided keys
	for (const key of CONFIG_KEYS) {
		if (key in pluginConfig) {
			const value = pluginConfig[key];
			if (!isNil(value) && !VALIDATORS[key](value)) {
				errors.push(new Error(`Invalid "${key}" option: ${value}`));
			}
		}
	}

	if (errors.length > 0) {
		throw new AggregateErrorPkg(errors);
	}
}
