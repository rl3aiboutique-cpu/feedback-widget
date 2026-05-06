/**
 * Per-type metadata used by the FeedbackForm component.
 *
 * v0.2.0 collapsed every type onto the same three-field form (title,
 * description, expected_outcome). The TypeDef now only carries the
 * label + tooltip translations for the type chip — there are no
 * type-specific fields, no persona requirement, no linked-stories
 * requirement. Adding a 7th type is just appending a new entry here
 * plus matching translation keys.
 */

import type { FeedbackTypeKey } from "../types";

export interface TypeDef {
	key: FeedbackTypeKey;
	/** translation key for the chip label */
	labelKey: string;
	/** translation key for the tooltip on the chip */
	hintKey: string;
}

export const TYPE_DEFS: TypeDef[] = [
	{
		key: "bug",
		labelKey: "feedback.type.bug",
		hintKey: "feedback.type.bug_hint",
	},
	{
		key: "ui",
		labelKey: "feedback.type.ui",
		hintKey: "feedback.type.ui_hint",
	},
	{
		key: "performance",
		labelKey: "feedback.type.performance",
		hintKey: "feedback.type.performance_hint",
	},
	{
		key: "new_feature",
		labelKey: "feedback.type.new_feature",
		hintKey: "feedback.type.new_feature_hint",
	},
	{
		key: "extend_feature",
		labelKey: "feedback.type.extend_feature",
		hintKey: "feedback.type.extend_feature_hint",
	},
	{
		key: "other",
		labelKey: "feedback.type.other",
		hintKey: "feedback.type.other_hint",
	},
];

export function getTypeDef(key: FeedbackTypeKey): TypeDef {
	const def = TYPE_DEFS.find((d) => d.key === key);
	if (!def) {
		throw new Error(`Unknown feedback type: ${key}`);
	}
	return def;
}
