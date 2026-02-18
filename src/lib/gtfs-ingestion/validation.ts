import JSZip from "jszip";
import { requiredFiles } from "./schema";
import { logger } from "@/lib/logger";

export const validateZipContents = async (
  file: File | ArrayBuffer | Blob,
  onProgress?: (percent: number, message: string) => void
) => {
  try {
    onProgress?.(0, "Validating zip file...");

    const zip = new JSZip();
    const loadedZip = await zip.loadAsync(file);

    onProgress?.(50, "Checking required files...");

    const requiredFilesList = Object.entries(requiredFiles)
      .filter(([_, info]) => info.fileType === "required")
      .map(([filename]) => filename);

    const missingRequired = requiredFilesList.filter(
      (filename) => !loadedZip.files[filename] || loadedZip.files[filename].dir
    );

    if (missingRequired.length > 0) {
      throw new Error(`Missing required GTFS files: ${missingRequired.join(", ")}`);
    }

    onProgress?.(100, "Validation complete!");
    return true;
  } catch (error) {
    logger.error("Error validating zip file:", error);
    throw error;
  }
};

export const readZipFiles = async (
  file: File | ArrayBuffer | Blob,
  onProgress?: (percent: number, message: string) => void
) => {
  try {
    onProgress?.(0, "Initializing zip parser...");

    const zip = new JSZip();

    onProgress?.(10, "Loading zip file...");
    let loadedZip: JSZip;

    try {
      loadedZip = await zip.loadAsync(file);
    } catch (error) {
      throw new Error(`Failed to load zip file: ${error instanceof Error ? error.message : 'Invalid zip format'}`);
    }

    onProgress?.(30, "Analyzing zip contents...");

    const fileStatus: {
      [key: string]: {
        inZip: boolean;
        content: string | null;
        fileType: string;
        size?: number;
      }
    } = {};

    Object.keys(requiredFiles).forEach((requiredFile) => {
      fileStatus[requiredFile] = {
        inZip: false,
        content: null,
        fileType: requiredFiles[requiredFile].fileType
      };
    });

    onProgress?.(40, "Reading file contents...");

    const filesToProcess = Object.keys(loadedZip.files).filter(
      (filename) => {
        const isRequiredFile = Object.keys(requiredFiles).includes(filename);
        return !loadedZip.files[filename].dir && isRequiredFile;
      }
    );

    let processedCount = 0;
    for (const filename of filesToProcess) {
      try {
        const content = await loadedZip.files[filename].async("text");
        const fileSize = loadedZip.files[filename]._data?.uncompressedSize || content.length;

        fileStatus[filename] = {
          inZip: true,
          content: content || null,
          fileType: requiredFiles[filename].fileType,
          size: fileSize
        };

        processedCount++;
        const progress = 40 + (processedCount / filesToProcess.length) * 50;
        onProgress?.(progress, `Processed ${filename} (${(fileSize / 1024).toFixed(2)} KB)`);
      } catch (error) {
        logger.error(`Error reading ${filename}:`, error);
        throw new Error(`Failed to read ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    onProgress?.(95, "Validating file structure...");

    const requiredFilesList = Object.entries(requiredFiles)
      .filter(([_, info]) => info.fileType === "required")
      .map(([filename]) => filename);

    const missingRequired = requiredFilesList.filter(
      (filename) => !fileStatus[filename]?.inZip || !fileStatus[filename]?.content
    );

    if (missingRequired.length > 0) {
      throw new Error(`Missing required GTFS files: ${missingRequired.join(", ")}`);
    }

    onProgress?.(100, "Upload complete!");

    return fileStatus;
  } catch (error) {
    logger.error("Error in readZipFiles:", error);
    throw error;
  }
};
