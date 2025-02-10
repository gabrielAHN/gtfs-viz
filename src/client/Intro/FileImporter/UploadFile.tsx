import React from "react";

import { Upload } from 'lucide-react';
import { Button } from "@/components/ui/button";


interface UploadFileProps {
  handleFileUpload: (file: File) => void;
}

export default function UploadFile({
  handleFileUpload,
}: UploadFileProps) {
  const fileInputRef = React.useRef < HTMLInputElement | null > (null);

  const onButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="mb-2">
      <input
        type="file"
        accept=".zip"
        ref={fileInputRef}
        hidden
        onChange={handleFileUpload}
      />
      <Button
        variant={"outline"}
        className="w-[30vh]"
        onClick={onButtonClick}
      >
        <Upload /> Upload GTFS Zip File
      </Button>
    </div>
  );
}
