import JSZip from 'jszip';

export const readZipFiles = async (file) => {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(file);
  const fileContents = {};

  await Promise.all(
    Object.keys(loadedZip.files).map(async (filename) => {
      if (!loadedZip.files[filename].dir) {
        const content = await loadedZip.files[filename].async('text');
        fileContents[filename] = content;
      }
    })
  );

  return fileContents;
};