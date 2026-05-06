/**
 * Lazy wrapper for the iter workspace.
 *
 * The host imports this from the package's public surface; the
 * underlying ``IterWorkspace.tsx`` (and its markdown-it dynamic
 * import) only loads when the user actually opens the workspace,
 * keeping the always-loaded widget bundle under the size budget.
 */

import { Suspense, lazy } from "react";

import type { IterWorkspaceProps } from "./IterWorkspace";

const _Inner = lazy(async () => {
	const mod = await import("./IterWorkspace");
	return { default: mod.default };
});

export function IterWorkspaceLazy(props: IterWorkspaceProps) {
	return (
		<Suspense
			fallback={
				<div className="fixed inset-0 z-[60] flex items-center justify-center bg-background text-sm text-muted-foreground">
					Loading workspace…
				</div>
			}
		>
			<_Inner {...props} />
		</Suspense>
	);
}
