import React from "react"
import ReactDOM from "react-dom/client"
import { ThemeProvider } from "@/context/theme.client"
import App from "./App"
import "@/styles/index.css"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
)
