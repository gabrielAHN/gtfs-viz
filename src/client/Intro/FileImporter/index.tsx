import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePageViewContext, useDuckDB } from "@/context/combinedContext";
import { readZipFiles } from "@/functions/stations/gtfsUploader/fileParser";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

import ingestFile from "@/hooks/DuckdbCalls/Ingestion/FileIngesting";
import createFormatedTables from "@/hooks/DuckdbCalls/Ingestion/CreateFormatedTables";

import ExampleDatasets from "./ExampleDatasets";
import UploadFile from "./UploadFile";

export default function FileImporter() {
  const queryClient = useQueryClient();
  const { db, conn } = useDuckDB();
  const { setPageState } = usePageViewContext();

  const [csvContent, setCsvContent] = useState < any > (null);
  const [ErrorMessage, setErrorMessage] = useState < string | null > (null);
  const [LoadingState, setLoadingState] = useState(false);

  const {
    data: uploadData,
    isError: isUploadError,
    error: uploadError,
  } = useQuery({
    queryKey: ["fetchUploadData"],
    queryFn: () => ingestFile(csvContent, db, conn),
    enabled: !!csvContent,
    onSuccess: () => {
      setLoadingState(true);
    },

    onError: () => {
      setLoadingState(false);
    },
    retry: false,
  });

  const {
    isLoading: isFormattingLoading,
    isError: isFormattingError,
    error: formattingError,
  } = useQuery({
    queryKey: ["createFormatedTables"],
    queryFn: () => createFormatedTables(conn),
    enabled: !!uploadData && !isUploadError,
    onError: () => {


      setLoadingState(false);
    },
    onSettled: () => {

      setLoadingState(false);
    },
    retry: false,
  });


  const errorImporting = (fileData: any) => {
    const missingFiles: string[] = [];
    Object.entries(fileData).forEach(([key, value]: any) => {
      if (value.fileType === "required" && !value.content) {
        missingFiles.push(key);
      }
    });

    if (missingFiles.length > 0) {
      setErrorMessage(`Missing files: ${missingFiles.join(", ")}`);
      return true;
    }
    return false;
  };

  const resetBeforeNewUpload = () => {
    setErrorMessage(null);
    queryClient.removeQueries(["fetchUploadData"]);
    queryClient.removeQueries(["createFormatedTables"]);
  };




  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    resetBeforeNewUpload();
    setLoadingState(true);

    const file = event.target.files?.[0];
    if (file && file.type === "application/zip") {
      const fileData = await readZipFiles(file);
      const errorStatus = errorImporting(fileData);
      if (!errorStatus) {
        setCsvContent(fileData);
      } else {
        setLoadingState(false);
      }
    } else {
      setLoadingState(false);
    }
  };

  const handleExampleFileUpload = async (url: string) => {
    resetBeforeNewUpload();
    setLoadingState(true);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      const arrayBuffer = await response.arrayBuffer();
      const fileData = await readZipFiles(arrayBuffer);
      const errorStatus = errorImporting(fileData);
      if (!errorStatus) {
        setCsvContent(fileData);
      } else {
        setLoadingState(false);
      }
    } catch (error) {
      setLoadingState(false);
    }
  };

  const handleCancel = () => {
    window.location.reload();
  };

  useEffect(() => {
    if (uploadData && !isFormattingLoading) {
      setPageState("dashboard");
    }
  }, [uploadData, isFormattingLoading, setPageState]);


  const showUploadComponents = !LoadingState && !isUploadError && !ErrorMessage;
  const showErrorScreen = isUploadError || ErrorMessage;

  return (
    <div className="flex flex-col items-center">
      {isUploadError && (
        <div className="p-3 bg-red-200 border-4 text-xs shadow-md rounded-xl border-red-400 max-w-[30vh] mb-4">
          Error: {(uploadError as Error)?.message}
        </div>
      )}
      {ErrorMessage && (
        <div className="container p-3 bg-yellow-200 border-4 text-xs shadow-md rounded-xl border-yellow-400 mb-4">
          {ErrorMessage}
        </div>
      )}
      {showErrorScreen ? (
        <>
          <UploadFile handleFileUpload={handleFileUpload} />
          <ExampleDatasets handleExampleFileUpload={handleExampleFileUpload} />
        </>
      ) : (
        <>
          {showUploadComponents && (
            <>
              <UploadFile handleFileUpload={handleFileUpload} />
              <ExampleDatasets handleExampleFileUpload={handleExampleFileUpload} />
            </>
          )}
          {LoadingState && (
            <>
              <Progress className="w-[10em] m-4" indeterminate />
              <Button
                variant="destructive"
                onClick={handleCancel}
                className="w-full max-w-xs"
              >
                Cancel
              </Button>
            </>
          )}
        </>
      )}
    </div>
  );
}
