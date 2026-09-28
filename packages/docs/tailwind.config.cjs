const path = require("node:path")
const web = require("../web/tailwind.config.js")

module.exports = {
  ...web,
  content: [
    path.resolve(__dirname, "src/index.html"),
    path.resolve(__dirname, "src/**/*.{ts,tsx}"),
    path.resolve(__dirname, "../web/src/components/ui/{button,badge,separator,ThemeSwitcher}.tsx"),
  ],
}
