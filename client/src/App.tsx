import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import BuildingList from "@/pages/buildings/list";
import ReportList from "@/pages/reports/list";
import TechniciansList from "@/pages/technicians/list";
import TypologiesList from "@/pages/typologies/list";
import NoiseClassesList from "@/pages/noise-classes/list";
import AggressivenessClassesList from "@/pages/aggressiveness-classes/list";
import UsersList from "@/pages/users/list";
import BioclimaticZonesList from "@/pages/bioclimatic-zones";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {isLoading || !isAuthenticated ? (
        <Route path="/" component={Login} />
      ) : (
        <>
          <Route path="/" component={Dashboard} />
          <Route path="/buildings" component={BuildingList} />
          <Route path="/reports" component={ReportList} />
          <Route path="/technicians" component={TechniciansList} />
          <Route path="/typologies" component={TypologiesList} />
          <Route path="/noise-classes" component={NoiseClassesList} />
          <Route path="/aggressiveness-classes" component={AggressivenessClassesList} />
          <Route path="/bioclimatic-zones" component={BioclimaticZonesList} />
          <Route path="/users" component={UsersList} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
