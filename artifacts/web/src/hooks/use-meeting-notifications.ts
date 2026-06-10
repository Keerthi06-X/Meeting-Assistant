import { useRef, useEffect } from "react";
import { useListMeetings, getListMeetingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { toast } from "sonner";

interface TrackedState {
  status: string;
  analysis_status: string | null;
}

export function useGlobalMeetingNotifications() {
  const [location] = useLocation();
  const queryClient = useQueryClient();
  const prevStates = useRef<Map<number, TrackedState>>(new Map());
  const isFirstLoad = useRef(true);

  const { data: meetings } = useListMeetings();

  useEffect(() => {
    const interval = setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: getListMeetingsQueryKey() });
    }, 3000);
    return () => clearInterval(interval);
  }, [queryClient]);

  useEffect(() => {
    if (!meetings) return;

    if (isFirstLoad.current) {
      meetings.forEach((m) => {
        prevStates.current.set(m.id, {
          status: m.status,
          analysis_status: m.analysis_status ?? null,
        });
      });
      isFirstLoad.current = false;
      return;
    }

    meetings.forEach((m) => {
      const prev = prevStates.current.get(m.id);
      const next: TrackedState = {
        status: m.status,
        analysis_status: m.analysis_status ?? null,
      };

      if (!prev) {
        prevStates.current.set(m.id, next);
        return;
      }

      const onThisDetailPage = location === `/meetings/${m.id}`;

      if (!onThisDetailPage) {
        if (prev.status === "transcribing" && m.status === "transcribed") {
          toast.success("Transcription complete", {
            description: m.original_filename,
            duration: 6000,
            action: {
              label: "View",
              onClick: () => {
                window.location.href = `/meetings/${m.id}`;
              },
            },
          });
        }

        if (prev.status === "transcribing" && m.status === "failed") {
          toast.error("Transcription failed", {
            description: m.original_filename,
            duration: 8000,
            action: {
              label: "Retry",
              onClick: () => {
                window.location.href = `/meetings/${m.id}`;
              },
            },
          });
        }

        if (
          prev.analysis_status === "analyzing" &&
          m.analysis_status === "analyzed"
        ) {
          toast.success("AI report ready", {
            description: m.original_filename,
            duration: 8000,
            action: {
              label: "View Report",
              onClick: () => {
                window.open(`/meetings/${m.id}/report`, "_blank");
              },
            },
          });
        }

        if (
          prev.analysis_status === "analyzing" &&
          m.analysis_status === "analysis_failed"
        ) {
          toast.error("Analysis failed", {
            description: m.original_filename,
            duration: 8000,
            action: {
              label: "Retry",
              onClick: () => {
                window.location.href = `/meetings/${m.id}`;
              },
            },
          });
        }
      }

      prevStates.current.set(m.id, next);
    });
  }, [meetings, location]);
}
