import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [react()],
	server: {
		host: "0.0.0.0",
		port: 3000,
	},
	preview: {
		host: "0.0.0.0",
		port: 3000,
	},
	define: {
		"import.meta.env.VITE_API_URL": JSON.stringify(
			process.env.VITE_API_URL ?? "http://localhost:9200",
		),
		"import.meta.env.VITE_FEEDBACK_ENABLED": JSON.stringify("true"),
	},
});
