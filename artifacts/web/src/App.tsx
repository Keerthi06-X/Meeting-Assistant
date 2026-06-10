import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import { Layout } from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import Upload from "@/pages/upload";
import MeetingsList from "@/pages/meetings-list";
import MeetingDetail from "@/pages/meeting-detail";
import MeetingReport from "@/pages/meeting-report";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      {/* Standalone print page — no sidebar */}
      <Route path="/meetings/:id/report" component={MeetingReport} />
      {/* All other pages with sidebar */}
      <Route>
        <Layout>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/upload" component={Upload} />
            <Route path="/meetings" component={MeetingsList} />
            <Route path="/meetings/:id" component={MeetingDetail} />
            <Route component={NotFound} />
          </Switch>
        </Layout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
