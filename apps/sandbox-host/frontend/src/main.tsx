import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import "./styles.css";
import "@rl3/feedback-widget/styles.css";

const queryClient = new QueryClient({
	defaultOptions: { queries: { retry: 1 } },
});

const rootEl = document.getElementById("root");
if (!rootEl) {
	throw new Error("#root not found");
}

createRoot(rootEl).render(
	<StrictMode>
		<QueryClientProvider client={queryClient}>
			<App />
		</QueryClientProvider>
	</StrictMode>,
);
