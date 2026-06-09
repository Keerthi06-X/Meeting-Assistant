import { useListMeetings, useDeleteMeeting, getListMeetingsQueryKey, getGetMeetingStatsQueryKey } from "@workspace/api-client-react";
import { formatBytes, formatDate } from "@/lib/format";
import { Link } from "wouter";
import { FileAudio, Trash2, Search, MoreHorizontal, Download, Play, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function MeetingsList() {
  const { data: meetings, isLoading } = useListMeetings();
  const deleteMeeting = useDeleteMeeting();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredMeetings = meetings?.filter(m => 
    m.original_filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.file_format.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this meeting?")) return;
    
    try {
      await deleteMeeting.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListMeetingsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetMeetingStatsQueryKey() });
      toast.success("Meeting deleted successfully");
    } catch (err) {
      toast.error("Failed to delete meeting");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'processing':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Processing</Badge>;
      case 'done':
        return <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100">Ready</Badge>;
      case 'uploaded':
      default:
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-100">Uploaded</Badge>;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">All Meetings</h1>
          <p className="text-muted-foreground">Manage and review all your uploaded meeting recordings.</p>
        </div>
        <Link href="/upload" className="block">
          <Button className="w-full sm:w-auto gap-2">
            <Plus className="w-4 h-4" />
            Upload Meeting
          </Button>
        </Link>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/20">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input 
              placeholder="Search meetings by name or format..." 
              className="pl-9 bg-background"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="p-4 space-y-4">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : filteredMeetings.length > 0 ? (
          <div className="divide-y border-border">
            {filteredMeetings.map(meeting => (
              <div key={meeting.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors group">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <FileAudio className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <Link href={`/meetings/${meeting.id}`} className="font-semibold text-base hover:text-primary hover:underline transition-colors block truncate pr-4">
                      {meeting.original_filename}
                    </Link>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground">
                      <Badge variant="outline" className="font-mono text-[10px] h-5 py-0 bg-background">
                        {meeting.file_format}
                      </Badge>
                      <span className="text-xs">{formatBytes(meeting.file_size)}</span>
                      <span className="text-xs text-muted-foreground/60">•</span>
                      <span className="text-xs">{formatDate(meeting.uploaded_at)}</span>
                      <span className="text-xs text-muted-foreground/60">•</span>
                      {getStatusBadge(meeting.status)}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 pl-4 shrink-0">
                  <Link href={`/meetings/${meeting.id}`} className="hidden md:block">
                    <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                      Details
                    </Button>
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <Link href={`/meetings/${meeting.id}`}>
                        <DropdownMenuItem className="cursor-pointer gap-2">
                          <Play className="w-4 h-4" /> View Details
                        </DropdownMenuItem>
                      </Link>
                      <DropdownMenuItem className="cursor-pointer gap-2" disabled>
                        <Download className="w-4 h-4" /> Download Original
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        className="cursor-pointer text-destructive focus:text-destructive gap-2" 
                        onClick={() => handleDelete(meeting.id)}
                      >
                        <Trash2 className="w-4 h-4" /> Delete Meeting
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 px-4">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-muted-foreground opacity-50" />
            </div>
            <h3 className="text-lg font-medium mb-1">No meetings found</h3>
            <p className="text-muted-foreground">
              {searchTerm ? "Try adjusting your search terms." : "You haven't uploaded any meetings yet."}
            </p>
            {!searchTerm && (
              <Link href="/upload" className="block mt-6">
                <Button>Upload your first meeting</Button>
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
