import {
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
} from "@/types/objectTypes";

const PageViewContext = createContext<PageViewContextType | undefined>(
  undefined
);
const StationViewContext = createContext<StationViewContextType | undefined>(
  undefined
);
const DuckDBContext = createContext<DuckDBContextType | null>(null);

export const CombinedProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [PageState, setPageState] = useState<string>("intro");
  const [StationView, setStationView] = useState<any>("");
  const [dbInstance, setDbInstance] = useState<any>(null);
  const [connInstance, setConnInstance] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [initialized, setInitialized] = useState<boolean>(false);

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
          {children}
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
