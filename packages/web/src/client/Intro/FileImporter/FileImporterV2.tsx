

import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { logger } from "@/lib/logger";

import { useGTFSExtension } from "./useGTFSExtension";
import ExampleDatasets from "./ExampleDatasets";
import UploadFile from "./UploadFile";

export default function FileImporterV2() {
  const router = useRouter();
  const { ingest, progress, error, isLoading, cancel, reset } = useGTFSExtension();

  const [validationError, setValidationError] = useState<string | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    reset();
    setValidationError(null);

    const file = event.target.files?.[0];

    if (!file) {
      setValidationError("No file selected");
      return;
    }

    if (!file.name.endsWith('.zip')) {
      setValidationError("Please upload a ZIP file");
      return;
    }

    logger.log(`📦 Uploading ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

    try {
      const result = await ingest(file);

      if (result) {

        if (result.hasStations) {
          setTimeout(() => router.navigate({ to: "/stations/map" }), 1000);
        } else if (result.hasStops) {
          setTimeout(() => router.navigate({ to: "/stops/map" }), 1000);
        } else {
          setValidationError("No stations or stops found in the GTFS file");
        }
      }
    } catch (err) {
      logger.error('Upload failed:', err);
    }
  };

  const handleExampleFileUpload = async (url: string) => {
    reset();
    setValidationError(null);

    logger.log(`🌐 Loading example dataset from ${url}`);

    try {
      const result = await ingest(url);

      if (result) {

        if (result.hasStations) {
          setTimeout(() => router.navigate({ to: "/stations/map" }), 1000);
        } else if (result.hasStops) {
          setTimeout(() => router.navigate({ to: "/stops/map" }), 1000);
        } else {
          setValidationError("No stations or stops found in the GTFS file");
        }
      }
    } catch (err) {
      logger.error('Example dataset load failed:', err);
    }
  };

  const handleCancel = () => {
    cancel();
  };

  const showUploadComponents = !isLoading;

  return (
    <div className="flex flex-col items-center w-full max-w-2xl mx-auto">
      {}
      {error && (
        <div className="w-full bg-red-50 dark:bg-red-900/20 border-2 border-red-400 shadow-md rounded-lg mb-4 overflow-hidden">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="ingestion-error" className="border-none">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <span className="font-semibold text-red-800 dark:text-red-200">
                  ❌ GTFS Ingestion Error
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-3">
                  <p className="text-red-700 dark:text-red-300 text-sm whitespace-pre-wrap">
                    {error}
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-400">
                    The database has been reset. Please try uploading the file again.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => reset()}
                    className="mt-2"
                  >
                    Try Again
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      )}

      {}
      {validationError && (
        <div className="w-full bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-400 shadow-md rounded-lg mb-4 overflow-hidden">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="validation-error" className="border-none">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <span className="font-semibold text-yellow-800 dark:text-yellow-200">
                  ⚠️ Validation Error
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-3">
                  <p className="text-yellow-700 dark:text-yellow-300 text-sm whitespace-pre-wrap">
                    {validationError}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setValidationError(null)}
                    className="mt-2"
                  >
                    Dismiss
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      )}

      {}
      {showUploadComponents && (
        <>
          <UploadFile handleFileUpload={handleFileUpload} />
          <ExampleDatasets handleExampleFileUpload={handleExampleFileUpload} />
        </>
      )}

      {}
      {isLoading && progress && (
        <>
          <div className="w-full max-w-md space-y-2">
            <Progress
              className="w-full m-4"
              value={progress.percent}
              max={100}
            />
            {progress.message && (
              <p className="text-sm text-center text-muted-foreground">
                {progress.message}
              </p>
            )}
            <p className="text-xs text-center text-muted-foreground">
              {progress.step}
            </p>
          </div>
          <Button
            variant="destructive"
            onClick={handleCancel}
            className="w-full max-w-xs mt-4"
          >
            Cancel
          </Button>
        </>
      )}
    </div>
  );
}
