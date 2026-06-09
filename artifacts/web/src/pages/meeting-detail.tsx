import { useParams, Link, useLocation } from "wouter";
import { 
  useGetMeeting, 
  useDeleteMeeting, 
  getListMeetingsQueryKey, 
  getGetMeetingStatsQueryKey,
  useRetryTranscription,
  getGetMeetingQueryKey
} from "@workspace/api-client-react";
import { formatBytes, formatDate } from "@/lib/format";
import { 
  ArrowLeft, FileAudio, Trash2, Calendar, HardDrive, 
  FileType, CheckCircle2, Clock, AlertCircle, Loader2, XCircle, FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState, useEffect } from "react";

interface TranscriptLine {
  timestamp: string | null;
  speaker: string | null;
  content: string;
}

function parseTranscriptLine(line: string): TranscriptLine {
  // Matches: [00:00:03] Speaker Name: rest of text
  const match = line.match(/^\[(\d{2}:\d{2}:\d{2})\]\s+([^:]+):\s*(.+)$/);
  if (match) {
    return { timestamp: match[1], speaker: match[2].trim(), content: match[3].trim() };
  }
  return { timestamp: null, speaker: null, content: line };
}

export default function MeetingDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const meetingId = id ? parseInt(id, 10) : 0;
  
  const [refetchInterval, setRefetchInterval] = useState<number | false>(false);

  const { data: meeting, isLoading, isError } = useGetMeeting(meetingId, {
    query: {
      enabled: !!meetingId,
      queryKey: getGetMeetingQueryKey(meetingId),
      refetchInterval,
    }
  });

  useEffect(() => {
    if (meeting?.status === "transcribing") {
      setRefetchInterval(2000);
    } else {
      setRefetchInterval(false);
    }
  }, [meeting?.status]);

  const deleteMeeting = useDeleteMeeting();
  const retryTranscription = useRetryTranscription();

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this meeting? This action cannot be undone.")) return;
    
    try {
      await deleteMeeting.mutateAsync({ id: meetingId });
      queryClient.invalidateQueries({ queryKey: getListMeetingsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetMeetingStatsQueryKey() });
      toast.success("Meeting deleted successfully");
      setLocation("/meetings");
    } catch (err) {
      toast.error("Failed to delete meeting");
    }
  };

  const handleRetry = async () => {
    try {
      await retryTranscription.mutateAsync({ id: meetingId });
      queryClient.invalidateQueries({ queryKey: getGetMeetingQueryKey(meetingId) });
      toast.success("Transcription retried");
    } catch (err) {
      toast.error("Failed to retry transcription");
    }
  };

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="w-12 h-12 text-destructive mb-4" />
        <h2 className="text-2xl font-bold mb-2">Meeting Not Found</h2>
        <p className="text-muted-foreground mb-6">The meeting you're looking for doesn't exist or has been deleted.</p>
        <Link href="/meetings">
          <Button>Return to Meetings</Button>
        </Link>
      </div>
    );
  }

  // Calculate word count if transcribed
  const wordCount = meeting?.transcript ? meeting.transcript.split(/\s+/).filter(w => w.length > 0).length : 0;

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/meetings">
          <Button variant="ghost" size="icon" className="h-8 w-8 mr-2">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="text-sm font-medium text-muted-foreground breadcrumbs">
          <Link href="/meetings" className="hover:text-foreground transition-colors">Meetings</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">Details</span>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-8">
          <div className="space-y-4">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-6 w-1/4" />
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      ) : meeting ? (
        <>
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0 shadow-sm border border-primary/20">
                <FileAudio className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2 break-all">
                  {meeting.original_filename}
                </h1>
                <div className="flex flex-wrap items-center gap-3">
                  {meeting.status === 'transcribed' ? (
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100 gap-1 border-none shadow-none">
                      <CheckCircle2 className="w-3 h-3" /> Transcribed
                    </Badge>
                  ) : meeting.status === 'transcribing' ? (
                    <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 gap-1 border-none shadow-none">
                      <Loader2 className="w-3 h-3 animate-spin" /> Transcribing
                    </Badge>
                  ) : meeting.status === 'failed' ? (
                    <Badge className="bg-red-100 text-red-800 hover:bg-red-100 gap-1 border-none shadow-none">
                      <XCircle className="w-3 h-3" /> Failed
                    </Badge>
                  ) : (
                    <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 gap-1 border-none shadow-none">
                      <CheckCircle2 className="w-3 h-3" /> Uploaded
                    </Badge>
                  )}
                  <Badge variant="outline" className="font-mono">ID: {meeting.id}</Badge>
                </div>
              </div>
            </div>
            <div className="flex gap-2 shrink-0 md:ml-auto">
              <Button variant="outline" className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground gap-2" onClick={handleDelete}>
                <Trash2 className="w-4 h-4" /> Delete
              </Button>
            </div>
          </div>

          <Card className="shadow-sm">
            <CardHeader className="bg-muted/20 border-b">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileAudio className="w-5 h-5 text-primary" />
                File Metadata
              </CardTitle>
              <CardDescription>Technical details about the uploaded recording</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                    <FileType className="w-5 h-5" />
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Format</dt>
                    <dd className="mt-1 text-base font-semibold">{meeting.file_format}</dd>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                    <HardDrive className="w-5 h-5" />
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">File Size</dt>
                    <dd className="mt-1 text-base font-semibold">{formatBytes(meeting.file_size)}</dd>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Upload Date</dt>
                    <dd className="mt-1 text-base font-semibold" title={new Date(meeting.uploaded_at).toLocaleString()}>
                      {formatDate(meeting.uploaded_at)}
                    </dd>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                    <FileAudio className="w-5 h-5" />
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Internal Filename</dt>
                    <dd className="mt-1 text-sm font-mono break-all text-muted-foreground bg-muted px-2 py-1 rounded">
                      {meeting.filename}
                    </dd>
                  </div>
                </div>
              </dl>
            </CardContent>
          </Card>
          
          {meeting.status === 'transcribed' && (
            <Card className="shadow-sm">
              <CardHeader className="bg-muted/20 border-b flex flex-row items-center justify-between py-4">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    Transcript
                  </CardTitle>
                  <CardDescription>
                    {meeting.transcribed_at ? `Completed ${formatDate(meeting.transcribed_at)}` : 'Transcript available'}
                  </CardDescription>
                </div>
                <Badge variant="secondary">{wordCount} words</Badge>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[600px] overflow-y-auto p-6 space-y-4">
                  {meeting.transcript ? (
                    meeting.transcript.split('\n').map((line, i) => {
                      if (!line.trim()) return null;
                      const parsed = parseTranscriptLine(line);
                      return (
                        <p key={i} className="text-base leading-relaxed text-foreground">
                          {parsed.timestamp && (
                            <span className="inline-block px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono text-xs mr-2 border border-border">
                              {parsed.timestamp}
                            </span>
                          )}
                          {parsed.speaker && (
                            <span className="font-semibold mr-2 text-primary">{parsed.speaker}:</span>
                          )}
                          {parsed.content}
                        </p>
                      );
                    })
                  ) : (
                    <p className="text-muted-foreground italic">No transcript content available.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {meeting.status === 'transcribing' && (
            <Card className="shadow-sm border-primary/20">
              <CardContent className="p-12 flex flex-col items-center justify-center text-center">
                <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                <h3 className="text-xl font-bold mb-2">Transcribing...</h3>
                <p className="text-muted-foreground max-w-sm">
                  Your audio is being processed. This usually takes a few moments.
                </p>
              </CardContent>
            </Card>
          )}

          {meeting.status === 'failed' && (
            <Card className="shadow-sm border-red-200">
              <CardContent className="p-12 flex flex-col items-center justify-center text-center">
                <XCircle className="w-12 h-12 text-destructive mb-4" />
                <h3 className="text-xl font-bold text-destructive mb-2">Transcription Failed</h3>
                <p className="text-muted-foreground max-w-sm mb-6">
                  Something went wrong during transcription.
                </p>
                <Button 
                  onClick={handleRetry} 
                  disabled={retryTranscription.isPending}
                  className="min-w-[150px]"
                >
                  {retryTranscription.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Retrying...</>
                  ) : (
                    "Retry Transcription"
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {meeting.status === 'uploaded' && (
            <Card className="shadow-sm">
              <CardContent className="p-12 flex flex-col items-center justify-center text-center">
                <Clock className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
                <h3 className="text-lg font-semibold text-muted-foreground mb-1">Queued for transcription</h3>
                <p className="text-sm text-muted-foreground opacity-70">
                  starting shortly...
                </p>
              </CardContent>
            </Card>
          )}

        </>
      ) : null}
    </div>
  );
}
