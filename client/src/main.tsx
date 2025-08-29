import { createRoot } from "react-dom/client";
import App from "./App";
import { throwIfResNotOk } from './lib/queryClient';

// Patch global fetch once to enforce auth-expiry redirect uniformly (401 / 440)
if (!(window as any).__fetchPatched) {
	const originalFetch = window.fetch.bind(window);
	window.fetch = async (input: any, init?: RequestInit) => {
		const res = await originalFetch(input, init);
		try {
			await throwIfResNotOk(res.clone());
		} catch (err) {
			// throwIfResNotOk already handled toast + redirect; just rethrow
			throw err;
		}
		return res;
	};
	(window as any).__fetchPatched = true;
}
import "./index.css";

createRoot(document.getElementById("root") as HTMLElement).render(<App />);
