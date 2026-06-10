import { useParams, Link } from "wouter";
import { useGetMeeting, getGetMeetingQueryKey } from "@workspace/api-client-react";
import { formatBytes } from "@/lib/format";
import { ArrowLeft, Printer, Mail, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export default function MeetingReport() {
  const { id } = useParams();
  const meetingId = id ? parseInt(id, 10) : 0;
  const [copied, setCopied] = useState(false);

  const { data: meeting, isLoading, isError } = useGetMeeting(meetingId, {
    query: {
      enabled: !!meetingId,
      queryKey: getGetMeetingQueryKey(meetingId),
    }
  });

  const handleCopyEmail = () => {
    if (!meeting) return;
    const lines: string[] = [
      `Meeting Report: ${meeting.original_filename}`,
      `Date: ${new Date(meeting.uploaded_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
      "",
      "SUMMARY",
      "-------",
      meeting.summary ?? "",
      "",
      "KEY DECISIONS",
      "-------------",
      ...(meeting.decisions ?? []).map((d, i) => `${i + 1}. ${d}`),
      "",
      "ACTION ITEMS",
      "------------",
      "Task | Assigned To | Deadline",
      ...(meeting.action_items ?? []).map(a => `${a.task} | ${a.assigned_to} | ${a.deadline}`),
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen py-20 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading report...</p>
      </div>
    );
  }

  if (isError || !meeting) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen py-20 text-center">
        <AlertCircle className="w-12 h-12 text-destructive mb-4" />
        <h2 className="text-2xl font-bold mb-2">Meeting Not Found</h2>
        <p className="text-muted-foreground mb-6">The meeting report could not be loaded.</p>
        <Button variant="outline" onClick={() => window.history.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Go Back
        </Button>
      </div>
    );
  }

  if (meeting.analysis_status !== "analyzed") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen py-20 text-center">
        <AlertCircle className="w-12 h-12 text-yellow-500 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Report Not Ready</h2>
        <p className="text-muted-foreground mb-6">Report not ready yet — analysis is still in progress.</p>
        <Button variant="outline" onClick={() => window.history.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="print:hidden flex items-center justify-between px-6 py-3 border-b bg-background sticky top-0 z-10">
        <Button variant="ghost" onClick={() => window.history.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleCopyEmail}>
            <Mail className="w-4 h-4 mr-2" />
            {copied ? "Copied!" : "Copy Email Text"}
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" /> Print / Save as PDF
          </Button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-8 py-10 print:px-0 print:py-0">
        {/* Header */}
        <div className="text-center mb-8 pb-6 border-b">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2 print:text-gray-500">Smart Meeting Assistant</p>
          <h1 className="text-2xl font-bold break-all">{meeting.original_filename}</h1>
          <p className="text-sm text-muted-foreground mt-2">
            {new Date(meeting.uploaded_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            {" · "}{meeting.file_format}{" · "}{formatBytes(meeting.file_size)}
            {meeting.analyzed_at ? " · Analyzed " + new Date(meeting.analyzed_at).toLocaleDateString() : ""}
          </p>
        </div>

        {/* Summary */}
        <section className="mb-8">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-primary mb-3 print:text-black">Meeting Summary</h2>
          <p className="text-base leading-relaxed text-foreground print:text-black">{meeting.summary}</p>
        </section>
        
        <hr className="my-6 print:border-gray-300" />

        {/* Decisions */}
        <section className="mb-8">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-primary mb-3 print:text-black">
            Key Decisions <span className="text-muted-foreground normal-case tracking-normal font-normal">({meeting.decisions?.length ?? 0})</span>
          </h2>
          <ol className="space-y-3">
            {meeting.decisions?.map((d, i) => (
              <li key={i} className="flex gap-3 text-base">
                <span className="font-bold text-primary print:text-black w-5 shrink-0">{i + 1}.</span>
                <span className="text-foreground print:text-black">{d}</span>
              </li>
            ))}
          </ol>
        </section>

        <hr className="my-6 print:border-gray-300" />

        {/* Action Items */}
        <section className="mb-8">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-primary mb-3 print:text-black">
            Action Items <span className="text-muted-foreground normal-case tracking-normal font-normal">({meeting.action_items?.length ?? 0} tasks)</span>
          </h2>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-border print:border-gray-400">
                <th className="text-left py-2 pr-4 font-semibold w-[50%] print:text-black">Task</th>
                <th className="text-left py-2 pr-4 font-semibold print:text-black">Assigned To</th>
                <th className="text-left py-2 font-semibold print:text-black">Deadline</th>
              </tr>
            </thead>
            <tbody>
              {meeting.action_items?.map((item, i) => (
                <tr key={i} className="border-b border-border/50 print:border-gray-200">
                  <td className="py-2.5 pr-4 print:text-black">{item.task}</td>
                  <td className="py-2.5 pr-4 text-muted-foreground print:text-black">{item.assigned_to}</td>
                  <td className="py-2.5 text-muted-foreground print:text-black">{item.deadline}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <div className="text-center text-xs text-muted-foreground mt-12 pt-6 border-t print:text-gray-400">
          Generated by Smart Meeting Assistant · {new Date().toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}