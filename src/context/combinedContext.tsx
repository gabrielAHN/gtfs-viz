import React, {
  createContext,
  useState,
  useContext,
  ReactNode,
  FC,
  useEffect,
} from "react";
import DuckDB from "./duckdbConfig";
import {
  PageViewContextType,
  StationViewContextType,
  DuckDBContextType,
  ThemeContextType,
} from "@/types/objectTypes";


const PageViewContext = createContext < PageViewContextType | undefined > (
  undefined
);
const StationViewContext = createContext < StationViewContextType | undefined > (
  undefined
);
const DuckDBContext = createContext < DuckDBContextType | null > (null);


const ThemeContext = createContext < ThemeContextType | undefined > (undefined);

export const CombinedProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [PageState, setPageState] = useState < string > ("intro");
  const [StationView, setStationView] = useState < any > ();
  const [dbInstance, setDbInstance] = useState < any > (null);
  const [connInstance, setConnInstance] = useState < any > (null);
  const [loading, setLoading] = useState < boolean > (true);
  const [initialized, setInitialized] = useState < boolean > (false);


  const [theme, setTheme] = useState < "light" | "dark" > ("light");
  const [themeVariables, setThemeVariables] = useState < Record < string, string>> (
    {}
  );

  const initializeDuckDB = async () => {
    setLoading(true);
    const { conn, db } = await DuckDB();
    setConnInstance(conn);
    setDbInstance(db);
    setLoading(false);
  };

  useEffect(() => {
    initializeDuckDB();
  }, []);

  const resetDb = () => {
    setInitialized(false);
    setDbInstance(null);
    setConnInstance(null);
    initializeDuckDB();
  };


  const applyTheme = (currentTheme: "light" | "dark") => {
    const root = document.documentElement;
    if (currentTheme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    setTheme(currentTheme);
  };


  const toggleTheme = () => {
    setTheme((prevTheme) => {
      const newTheme = prevTheme === "light" ? "dark" : "light";
      applyTheme(newTheme);
      localStorage.setItem("theme", newTheme);
      return newTheme;
    });
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    if (savedTheme) {
      applyTheme(savedTheme);
    } else {
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;
      applyTheme(prefersDark ? "dark" : "light");
    }
  }, []);

  useEffect(() => {
    const rootStyles = getComputedStyle(document.documentElement);

    const fetchThemeVariables = () => ({
      background: rootStyles.getPropertyValue("--background").trim(),
      foreground: rootStyles.getPropertyValue("--foreground").trim(),
      primary: rootStyles.getPropertyValue("--primary").trim(),
      secondary: rootStyles.getPropertyValue("--secondary").trim(),

    });

    setThemeVariables(fetchThemeVariables());

    const observer = new MutationObserver(() => {
      setThemeVariables(fetchThemeVariables());
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, [theme]);

  return (
    <DuckDBContext.Provider
      value={{
        db: dbInstance,
        conn: connInstance,
        loading,
        initialized,
        setInitialized,
        resetDb,
      }}
    >
      <PageViewContext.Provider value={{ PageState, setPageState }}>
        <StationViewContext.Provider value={{ StationView, setStationView }}>
          <ThemeContext.Provider
            value={{ theme, themeVariables, toggleTheme }}
          >
            {children}
          </ThemeContext.Provider>
        </StationViewContext.Provider>
      </PageViewContext.Provider>
    </DuckDBContext.Provider>
  );
};

export const usePageViewContext = (): PageViewContextType => {
  const context = useContext(PageViewContext);
  if (!context) {
    throw new Error(
      "usePageViewContext must be used within a CombinedProvider"
    );
  }
  return context;
};

export const useStationViewContext = (): StationViewContextType => {
  const context = useContext(StationViewContext);
  if (!context) {
    throw new Error(
      "useStationViewContext must be used within a CombinedProvider"
    );
  }
  return context;
};

export const useDuckDB = (): DuckDBContextType | null => {
  return useContext(DuckDBContext);
};

export const useThemeContext = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useThemeContext must be used within a CombinedProvider");
  }
  return context;
};
