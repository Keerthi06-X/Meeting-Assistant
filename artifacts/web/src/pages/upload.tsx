import { useState, useRef } from "react";
import { Link } from "wouter";
import { UploadCloud, FileAudio, CheckCircle2, AlertCircle, X, RefreshCw, List, ChevronRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListMeetingsQueryKey, getGetMeetingStatsQueryKey } from "@workspace/api-client-react";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

const ALLOWED_FORMATS = ["audio/mpeg", "audio/wav", "audio/x-m4a", "audio/mp4", "video/mp4"];
const ALLOWED_EXTENSIONS = [".mp3", ".wav", ".m4a", ".mp4"];

export default function Upload() {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [uploadedMeetingName, setUploadedMeetingName] = useState("");
  const [uploadedMeetingId, setUploadedMeetingId] = useState<number | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const validateFile = (f: File) => {
    const ext = f.name.substring(f.name.lastIndexOf(".")).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext) && !ALLOWED_FORMATS.includes(f.type)) {
      setStatus("error");
      setErrorMessage(`Invalid file format. Please upload ${ALLOWED_EXTENSIONS.join(", ")}`);
      return false;
    }
    return true;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const f = e.dataTransfer.files[0];
      if (validateFile(f)) {
        setFile(f);
        setStatus("idle");
        setErrorMessage("");
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      if (validateFile(f)) {
        setFile(f);
        setStatus("idle");
        setErrorMessage("");
      }
    }
  };

  const clearFile = () => {
    setFile(null);
    setStatus("idle");
    setProgress(0);
    setErrorMessage("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const uploadFile = async () => {
    if (!file) return;
    
    setStatus("uploading");
    setProgress(10); // Fake initial progress
    
    // Simulate gradual progress while fetching
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev;
        return prev + 10;
      });
    }, 200);

    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const response = await fetch("/api/meetings/upload", {
        method: "POST",
        body: formData,
      });
      
      clearInterval(interval);
      setProgress(100);
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Upload failed");
      }
      
      const meeting = await response.json();
      
      // Update state to success
      setStatus("success");
      setUploadedMeetingName(meeting.original_filename);
      setUploadedMeetingId(meeting.id);
      
      // Invalidate queries to refresh dashboard and list
      queryClient.invalidateQueries({ queryKey: getListMeetingsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetMeetingStatsQueryKey() });
      
    } catch (err: any) {
      clearInterval(interval);
      setStatus("error");
      setErrorMessage(err.message || "An unexpected error occurred");
      setProgress(0);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Upload Meeting</h1>
        <p className="text-muted-foreground">Upload your audio recordings to process and manage them.</p>
      </div>

      <div className="flex gap-2">
        {ALLOWED_EXTENSIONS.map(ext => (
          <Badge key={ext} variant="secondary" className="font-mono">{ext.toUpperCase().replace(".", "")}</Badge>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {status === "success" ? (
            <div className="flex flex-col items-center justify-center p-12 text-center space-y-6">
              <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">Upload Successful</h2>
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">{uploadedMeetingName}</span> has been uploaded securely.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Button variant="outline" onClick={clearFile} className="gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Upload Another
                </Button>
                {uploadedMeetingId ? (
                  <Link href={`/meetings/${uploadedMeetingId}`} className="block">
                    <Button className="gap-2 w-full">
                      View Details
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </Link>
                ) : (
                  <Link href="/meetings" className="block">
                    <Button className="gap-2 w-full">
                      View All Meetings
                      <List className="w-4 h-4" />
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <div className="p-8">
              {!file ? (
                <div 
                  className={cn(
                    "border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200 flex flex-col items-center justify-center cursor-pointer",
                    dragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"
                  )}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".mp3,.wav,.m4a,.mp4,audio/mpeg,audio/wav,audio/x-m4a,video/mp4"
                    onChange={handleChange}
                  />
                  <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
                    <UploadCloud className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-medium mb-2">Drag and drop file here</h3>
                  <p className="text-muted-foreground text-sm mb-6 max-w-sm">
                    Select your meeting recording file or drag and drop it into this area. Maximum file size is typically limited by the server configuration.
                  </p>
                  <Button variant="outline">Browse Files</Button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-muted/40 border rounded-lg p-4 flex items-start gap-4">
                    <div className="bg-primary/10 text-primary p-3 rounded-lg">
                      <FileAudio className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate" title={file.name}>{file.name}</h4>
                      <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                        <span>{formatBytes(file.size)}</span>
                        <Badge variant="secondary" className="text-[10px] h-5 py-0">
                          {file.name.split('.').pop()?.toUpperCase() || "UNKNOWN"}
                        </Badge>
                      </div>
                    </div>
                    {status === "idle" && (
                      <Button variant="ghost" size="icon" onClick={clearFile} className="text-muted-foreground hover:text-destructive">
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

                  {status === "error" && (
                    <div className="bg-destructive/10 text-destructive text-sm p-4 rounded-lg flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">Upload Failed</p>
                        <p>{errorMessage}</p>
                      </div>
                    </div>
                  )}

                  {status === "uploading" && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">Uploading...</span>
                        <span className="text-muted-foreground">{progress}%</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>
                  )}

                  {status !== "uploading" && (
                    <div className="flex justify-end gap-3 pt-4">
                      <Button variant="outline" onClick={clearFile}>Cancel</Button>
                      <Button onClick={uploadFile} className="gap-2">
                        <UploadCloud className="w-4 h-4" />
                        Start Upload
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
