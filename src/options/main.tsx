import React from "react";
import { createRoot } from "react-dom/client";
import "../styles/tailwind.css";
import "../popup/main.css";
import { App } from "./App";

const el = document.getElementById("root")!;
createRoot(el).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>,
);
