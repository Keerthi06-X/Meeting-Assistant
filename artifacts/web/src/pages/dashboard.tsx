import { useGetMeetingStats, useListMeetings } from "@workspace/api-client-react";
import { formatBytes, formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { FileAudio, HardDrive, Clock, BarChart3, ChevronRight, File } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetMeetingStats();
  const { data: meetings, isLoading: meetingsLoading } = useListMeetings();

  const recentMeetings = meetings?.slice(0, 5) || [];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back. Here's what's happening with your meetings.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover-elevate transition-all border-l-4 border-l-primary">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Meetings</CardTitle>
            <FileAudio className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-3xl font-bold text-foreground">{stats?.total_meetings || 0}</div>
            )}
          </CardContent>
        </Card>

        <Card className="hover-elevate transition-all border-l-4 border-l-chart-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Storage</CardTitle>
            <HardDrive className="w-4 h-4 text-chart-2" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-3xl font-bold text-foreground">{formatBytes(stats?.total_size_bytes || 0)}</div>
            )}
          </CardContent>
        </Card>

        <Card className="hover-elevate transition-all border-l-4 border-l-chart-3">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Recent Uploads</CardTitle>
            <Clock className="w-4 h-4 text-chart-3" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-3xl font-bold text-foreground">{stats?.recent_uploads || 0}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">In the last 7 days</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate transition-all border-l-4 border-l-chart-4">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Formats Breakdown</CardTitle>
            <BarChart3 className="w-4 h-4 text-chart-4" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-full" />
            ) : (
              <div className="flex flex-wrap gap-2 mt-1">
                {stats?.formats && Object.keys(stats.formats).length > 0 ? (
                  Object.entries(stats.formats).map(([format, count]) => (
                    <div key={format} className="flex items-center gap-1 text-sm bg-secondary px-2 py-1 rounded-md">
                      <span className="font-semibold text-secondary-foreground">{format}</span>
                      <span className="text-muted-foreground text-xs">{count as number}</span>
                    </div>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">No data</span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Meetings</CardTitle>
              <CardDescription>Your latest uploaded recordings</CardDescription>
            </div>
            <Link href="/meetings" className="text-sm text-primary hover:underline flex items-center">
              View all <ChevronRight className="w-4 h-4 ml-1" />
            </Link>
          </CardHeader>
          <CardContent>
            {meetingsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : recentMeetings.length > 0 ? (
              <div className="divide-y border rounded-md">
                {recentMeetings.map(meeting => (
                  <div key={meeting.id} className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <File className="w-5 h-5" />
                      </div>
                      <div>
                        <Link href={`/meetings/${meeting.id}`} className="font-medium hover:text-primary hover:underline transition-colors block">
                          {meeting.original_filename}
                        </Link>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                          <span className="bg-secondary px-1.5 py-0.5 rounded text-secondary-foreground font-medium">{meeting.file_format}</span>
                          <span>{formatBytes(meeting.file_size)}</span>
                          <span>{formatDate(meeting.uploaded_at)}</span>
                        </div>
                      </div>
                    </div>
                    <Link href={`/meetings/${meeting.id}`} className="hidden md:block">
                      <Button variant="ghost" size="sm">Details</Button>
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 bg-muted/20 border border-dashed rounded-lg">
                <FileAudio className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                <h3 className="font-medium text-lg mb-1">No meetings yet</h3>
                <p className="text-muted-foreground text-sm mb-4">Upload your first meeting to get started.</p>
                <Link href="/upload" className="block w-fit mx-auto">
                  <Button>Upload Meeting</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
