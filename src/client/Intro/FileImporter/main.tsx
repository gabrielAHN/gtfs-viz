import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePageViewContext, useDuckDB } from "@/context/combinedContext";
import { readZipFiles } from "@/functions/stations/gtfsUploader/fileParser";
import {
  Button,
  LinearProgress
} from "@mui/material";

import ingestFile from "@/hooks/DuckdbCalls/Ingestion/FileIngesting";
import createFormatedTables from "@/hooks/DuckdbCalls/Ingestion/CreateFormatedTables";
import ExampleDatasets from "./ExampleDatasets";
import UploadFile from "./UploadFile";


export default function FileImporter() {
  const { db, conn } = useDuckDB();
  const { setPageState } = usePageViewContext();
  const [csvContent, setCsvContent] = useState(null);
  const [ErrorMessage, setErrorMessage] = useState();
  const [LoadingState, setLoadingState] = useState(false);

  const fetchUploadData = useQuery({
    queryKey: ["fetchUploadData"],
    queryFn: () => ingestFile(csvContent, db, conn),
    enabled: !!csvContent,
    onSuccess: () => setLoadingState(true),
  });

  const fetchFormatedTables = useQuery({
    queryKey: ["createFormatedTables"],
    queryFn: () => createFormatedTables(db, conn),
    enabled: !!fetchUploadData.data,
    onSettled: () => setLoadingState(false),
  });

  const errorImporting = (fileData) => {
    const missingFiles = [];

    Object.entries(fileData).forEach(([keys, value]) => {
      if (value.fileType === "required" && !value.content) {
        missingFiles.push(keys);
      }
    });

    if (missingFiles.length > 0) {
      setErrorMessage(`Missing files: ${missingFiles.join(", ")}`);
      return true;
    }
    return false;
  };

  const handleFileUpload = async (event) => {
    setLoadingState(true);
    const file = event.target.files?.[0];
    if (file && file.type === "application/zip") {
      const fileData = await readZipFiles(file);
      const errorStatus = errorImporting(fileData);

      if (!errorStatus) {
        setCsvContent(fileData);
      }
    }
  };

  const handleExampleFileUpload = async (event) => {
    setLoadingState(true);
    const url = event.target.value.url;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      const arrayBuffer = await response.arrayBuffer();
      const fileData = await readZipFiles(arrayBuffer);
      setCsvContent(fileData);
    } catch (error) {
      console.error("Failed to load the file:", error);
    }
  };

  const handleCancel = () => {
    window.location.reload();
    setLoadingState(false);
  };

  useEffect(() => {
    if (fetchUploadData.data && !fetchFormatedTables.isLoading) {
      setPageState("dashboard");
    }
  }, [fetchFormatedTables.data, setPageState]);

  return (
    <div className="flex flex-col items-center space-y-5">
      {fetchUploadData.isError && (
        <div className="p-3 bg-red-200 border-4 text-xs shadow-md rounded-xl border-red-400 max-w-[30vh]">
          Error: {fetchUploadData.error.message}
        </div>
      )}
      {ErrorMessage && (
        <div className="p-3 bg-yellow-200 border-4 text-xs shadow-md rounded-xl border-yellow-400">
          {ErrorMessage}
        </div>
      )}
      {!LoadingState && (
        <>
          <UploadFile
            handleFileUpload={handleFileUpload}
            fetchFormatedTables={fetchFormatedTables}
          />
          <ExampleDatasets handleExampleFileUpload={handleExampleFileUpload} />
        </>
      )}
      {LoadingState && (
        <>
          <LinearProgress className="w-full" />
          <Button
            variant="outlined"
            color="error"
            onClick={handleCancel}
            className="w-full max-w-xs"
          >
            Cancel
          </Button>
        </>
      )}
    </div>
  );
}
