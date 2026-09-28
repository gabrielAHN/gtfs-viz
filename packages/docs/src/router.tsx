import { useEffect, useState } from "react"
import type { MouseEvent, ReactNode } from "react"

const listeners = new Set<() => void>()

export function navigate(to: string) {
  const url = new URL(to, window.location.href)
  if (url.origin !== window.location.origin) {
    window.location.href = to
    return
  }
  window.history.pushState(null, "", url.pathname + url.hash)
  listeners.forEach((listener) => listener())
  if (url.hash) {
    document.getElementById(url.hash.slice(1))?.scrollIntoView()
  } else {
    window.scrollTo(0, 0)
  }
}

export function usePathname() {
  const [pathname, setPathname] = useState(window.location.pathname)
  useEffect(() => {
    const update = () => setPathname(window.location.pathname)
    listeners.add(update)
    window.addEventListener("popstate", update)
    return () => {
      listeners.delete(update)
      window.removeEventListener("popstate", update)
    }
  }, [])
  return pathname
}

export function Link({
  to,
  className,
  children,
  ...rest
}: {
  to: string
  className?: string
  children: ReactNode
  "aria-current"?: "page"
}) {
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.button !== 0) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    navigate(to)
  }
  return (
    <a href={to} className={className} onClick={onClick} {...rest}>
      {children}
    </a>
  )
}
