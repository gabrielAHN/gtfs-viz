import { DocsButton, GithubButton } from "@/components/contact"

export default function PageFooter() {
  return (
    <div className="flex items-center justify-center gap-2 mt-4">
      <GithubButton />
      <DocsButton />
    </div>
  )
}
