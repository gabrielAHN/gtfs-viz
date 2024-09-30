import React, { ReactNode } from "react";

export interface HeaderObjectProps {
  SearchText: string;
  setSearchText: React.Dispatch<React.SetStateAction<string>>;
  StopsIdData: string[];
  StopIdDropdown: string[];
  setStopIdDropdown: React.Dispatch<React.SetStateAction<string[]>>;
  StopsNameData: string[];
  StopNameDropDown: string[];
  setStopNameDropDown: React.Dispatch<React.SetStateAction<string[]>>;
  PathwaysStatusData: string[];
  PathwaysStatusDropDown: string[];
  setPathwaysStatusDropDown: React.Dispatch<React.SetStateAction<string[]>>;
  WheelChairStatusDropDown: string[];
  setWheelChairStatusDropDown: React.Dispatch<React.SetStateAction<string[]>>;
  WheelchairStatusData: string[];
}

export type SetState<T> = React.Dispatch<React.SetStateAction<T>>;

export type DropdownChangeHandler<T> = (
  event: React.SyntheticEvent,
  value: T | null
) => void;

export type RenderSelectProps<T> = {
  data: T[];
  value: T[];
  onChange: (event: React.ChangeEvent<{ value: unknown }>) => void;
  label: string;
};

export type FetchProps = {
  conn: any;
  rowId?: string[];
  SearchText?: string;
  StopIdDropdown?: string[];
  StopNameDropDown?: string[];
  LocationsList?: string[];
  StationView?: any
  WheelChairStatusDropDown?: string[];
  PathwaysStatusDropDown?: string[];
};

export interface DuckDBContext {
  conn: any;
}

export interface ToggleTab {
  value: string;
  label: string;
  icon: JSX.Element;
}

export interface PageViewContextType {
  PageState: string;
  setPageState: React.Dispatch<React.SetStateAction<string>>;
}

export interface StationViewContextType {
  stationView: string;
  setStationView: React.Dispatch<React.SetStateAction<string>>;
}

export interface DuckDBContextType {
  db: any;
  conn: any;
  loading: boolean;
  initialized: boolean;
  setInitialized: React.Dispatch<React.SetStateAction<boolean>>;
  resetDb: () => void;
}

export interface DuckDBProviderProps {
  children: ReactNode;
}


export interface StationInfoData {
  stop_id: string;
  stop_name: string;
  stop_lon: number;
  stop_lat: number;
  exit_count: number;
  pathways_status: string;
  wheelchair_status: string;
}


export interface LocationType {
  location_type_name: string;
  stop_id: string;
}

export interface StationLocationListType {
  StationPartsData: LocationType[];
}

export interface StationStopIdsType {
  StopIdsData: { stop_id: string }[];
}

export interface HeaderStationViewProps {
  StationLocationList: StationLocationListType | null;
  SearchText: string;
  setSearchText: (text: string) => void;
  LocationsList: LocationType[];
  setLocationsList: (locations: LocationType[]) => void;
  StationStopIds: StationStopIdsType | null;
  StopsID: string | null;
  setStopsID: (id: string | null) => void;
}