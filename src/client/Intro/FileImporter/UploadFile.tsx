import React from "react";
import LoadingButton from "@mui/lab/LoadingButton";
import FileUploadOutlined from "@mui/icons-material/FileUploadOutlined";

interface UploadFileProps {
  handleFileUpload: (file: File) => void;
  fetchFormatedTables: { isLoading: boolean };
}

export default function UploadFile({
  handleFileUpload,
  fetchFormatedTables,
}: UploadFileProps) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const onButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <>
      <input
        type="file"
        accept=".zip"
        ref={fileInputRef}
        hidden
        onChange={handleFileUpload}
      />
      <LoadingButton
        size="large"
        fullWidth
        variant="outlined"
        loading={fetchFormatedTables.isLoading}
        endIcon={<FileUploadOutlined />}
        onClick={onButtonClick}
        className="w-full max-w-xs"
      >
        <span>Upload GTFS Zip File</span>
      </LoadingButton>
    </>
  );
}
