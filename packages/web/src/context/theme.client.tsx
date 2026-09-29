import React, { createContext, useState, useContext, ReactNode, FC, useEffect } from "react"

type Theme = "light" | "dark"

export const themeStorageKey = "gtfs-viz-theme"

const storedTheme = (): Theme | null => {
  try {
    const value = window.localStorage.getItem(themeStorageKey)
    return value === "dark" || value === "light" ? value : null
  } catch {
    return null
  }
}

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  themeVariables: Record<string, string>
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export const ThemeProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "light"

    return (
      storedTheme() ??
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    )
  })

  const [themeVariables, setThemeVariables] = useState<Record<string, string>>({})

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    try {
      window.localStorage.setItem(themeStorageKey, newTheme)
    } catch {}
  }

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== themeStorageKey) return
      if (event.newValue === "dark" || event.newValue === "light") setThemeState(event.newValue)
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark"
    setTheme(newTheme)
  }

  useEffect(() => {
    const root = document.documentElement
    if (theme === "dark") {
      root.classList.add("dark")
    } else {
      root.classList.remove("dark")
    }
  }, [theme])

  useEffect(() => {
    const rootStyles = getComputedStyle(document.documentElement)

    const fetchThemeVariables = () => ({
      background: rootStyles.getPropertyValue("--background").trim(),
      foreground: rootStyles.getPropertyValue("--foreground").trim(),
      primary: rootStyles.getPropertyValue("--primary").trim(),
      secondary: rootStyles.getPropertyValue("--secondary").trim(),
    })

    setThemeVariables(fetchThemeVariables())

    const observer = new MutationObserver(() => {
      setThemeVariables(fetchThemeVariables())
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    })

    return () => observer.disconnect()
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, themeVariables }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useThemeContext = (): ThemeContextType => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error("useThemeContext must be used within a ThemeProvider")
  }
  return context
}
