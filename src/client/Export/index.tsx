import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDuckDB } from "@/context/duckdb.client";

import { BiDownload } from 'react-icons/bi';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

import { useQueryClient } from "@tanstack/react-query";
import { exportingData } from "@/lib/duckdb/DataExporting/exportingData";

import StopsTable from "./components/StopsTable"

function Export() {
  const [FileTypes, setFileTypes] = useState({});
  const duckDB = useDuckDB();
  const { conn } = duckDB || {};

  const queryClient = useQueryClient()

  const { isLoading: exportLoading, refetch } = useQuery({
    queryKey: ['ExportingData', FileTypes],
    queryFn: () => exportingData({ conn, FileTypes }),
    enabled: false,
    staleTime: 0
  });

  const EditsStatus = Object.values(FileTypes).some((value) => value === true);

  useEffect(() => {
    if (exportLoading && duckDB) {
      duckDB.setIsResetting(true);
      duckDB.setLoadingMessage("Exporting data...");
      duckDB.setLoadingSubMessage("Preparing GTFS files for download");
    } else if (!exportLoading && duckDB) {
      duckDB.setIsResetting(false);
      duckDB.setLoadingMessage("");
      duckDB.setLoadingSubMessage("");
    }
  }, [exportLoading, duckDB]);

  const handleExport = async () => {
    await refetch({ force: true });
  };

  const handleCancel = (key) => {
    queryClient.cancelQueries({ queryKey: [key] })
  }

  if (exportLoading) (
    <>
      <Progress className="w-[10em] m-4" indeterminate />
      <Button
        variant="destructive"
        onClick={() => handleCancel('ExportingData')}
        className="w-full max-w-xs"
      >
        Cancel
      </Button>
    </>
  )

  return (
    <div className="">
      <h1 className="font-extrabold text-3xl mb-5">Export</h1>
      <p className="text-inherit mb-5 w">
        Choose the edits for each gtfs files that will be applied to the exported file.
      </p>
      <div className="flex gap-2 mb-5">
        <Button
          size={"lg"}
          onClick={handleExport}
          disabled={exportLoading || !EditsStatus}
          variant="secondary"
          className="flex items-center"
        >
          {exportLoading ? (
            "Exporting..."
          ) : (
            <span className="flex items-center">
              <BiDownload className="mr-2" />
              {EditsStatus ? (
                "Export Edit Files"
              ) : "No Changes to Export"
              }
            </span>
          )}
        </Button>
      </div>
      <StopsTable setFileTypes={setFileTypes} FileTypes={FileTypes} />
    </div>
  )
}

export default Export;
