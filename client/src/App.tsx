import { Switch, Route, Redirect } from "wouter";
import type { RouteProps } from "wouter";
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
import StatesList from "@/pages/states/list.tsx";
import CitiesList from "@/pages/cities/list.tsx";

function PrivateRoute(props: RouteProps) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <></>;
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  return <Route {...props} />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <PrivateRoute path="/" component={Dashboard} />
      <PrivateRoute path="/buildings" component={BuildingList} />
      <PrivateRoute path="/reports" component={ReportList} />
      <PrivateRoute path="/technicians" component={TechniciansList} />
      <PrivateRoute path="/typologies" component={TypologiesList} />
      <PrivateRoute path="/noise-classes" component={NoiseClassesList} />
      <PrivateRoute path="/aggressiveness-classes" component={AggressivenessClassesList} />
      <PrivateRoute path="/bioclimatic-zones" component={BioclimaticZonesList} />
      <PrivateRoute path="/states" component={StatesList} />
      <PrivateRoute path="/cities" component={CitiesList} />
      <PrivateRoute path="/users" component={UsersList} />
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
