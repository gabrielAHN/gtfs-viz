import path from "node:path"
import { fileURLToPath } from "node:url"

const rootDir = path.dirname(fileURLToPath(import.meta.url))

export default {
  plugins: {
    tailwindcss: { config: path.resolve(rootDir, "tailwind.config.cjs") },
    autoprefixer: {},
  },
}
