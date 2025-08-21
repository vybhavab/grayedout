import React from "react";
import { createRoot } from "react-dom/client";
import "./main.css";
import "../styles/tailwind.css";
import { App } from "./App";

const el = document.getElementById("root")!;
createRoot(el).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>,
);
