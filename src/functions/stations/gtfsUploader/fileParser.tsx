import JSZip from "jszip";
import { requiredFiles } from "./requiredFiles";

export const readZipFiles = async (file: File) => {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(file);
  const fileStatus: { [key: string]: { inZip: boolean; content: string | null,  typeFile: string} } = {};

  Object.keys(requiredFiles).forEach((requiredFile) => {
    fileStatus[requiredFile] = { inZip: false, content: null, fileType: requiredFiles[requiredFile].fileType };
  });


  await Promise.all(
    Object.keys(loadedZip.files).map(async (filename) => {
      const isRequiredFile = Object.keys(requiredFiles).includes(filename);
      
      if (!loadedZip.files[filename].dir && isRequiredFile) {
        const content = await loadedZip.files[filename].async("text");
        fileStatus[filename] = { inZip: true, content: content || null, typeFile: requiredFiles[filename].fileType };
      }
    })
  );
  return fileStatus;
};