import { useParams, Link, useLocation } from "wouter";
import { useGetMeeting, useDeleteMeeting, getListMeetingsQueryKey, getGetMeetingStatsQueryKey } from "@workspace/api-client-react";
import { formatBytes, formatDate } from "@/lib/format";
import { ArrowLeft, FileAudio, Trash2, Calendar, HardDrive, FileType, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";

export default function MeetingDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const meetingId = id ? parseInt(id, 10) : 0;
  
  const { data: meeting, isLoading, isError } = useGetMeeting(meetingId, {
    query: {
      enabled: !!meetingId
    }
  });

  const deleteMeeting = useDeleteMeeting();

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
                  {meeting.status === 'done' ? (
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100 gap-1 border-none shadow-none">
                      <CheckCircle2 className="w-3 h-3" /> Ready
                    </Badge>
                  ) : meeting.status === 'processing' ? (
                    <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 gap-1 border-none shadow-none">
                      <Clock className="w-3 h-3" /> Processing
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
          
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 text-center">
            <h3 className="font-semibold text-primary mb-2">Transcription Coming Soon</h3>
            <p className="text-sm text-muted-foreground max-w-lg mx-auto">
              Automated transcription and summarization features are currently in development. Soon you'll be able to read, search, and extract action items directly from this page.
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}
