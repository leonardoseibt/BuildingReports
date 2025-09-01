import { Switch, Route, Redirect } from "wouter";
import type { RouteProps } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { scheduleAutoRefresh } from "@/lib/authUtils";
import { useEffect } from "react";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import BuildingList from "@/pages/buildings/list";
import ReportList from "@/pages/reports/list";
import TechniciansList from "@/pages/technicians/list";
import TypologiesList from "@/pages/typologies/list";
import NoiseClassesList from "@/pages/noise-classes/list";
import AggressivenessClassesList from "@/pages/aggressiveness-classes/list";
import ConstructiveSystemsList from "@/pages/constructive-systems/list.tsx";
import RequirementsList from "@/pages/requirements/list.tsx";
import CriteriaList from "@/pages/criteria/list";
import AnalysesList from "@/pages/analyses/list";
import ParametersList from "@/pages/parameters/list";
import AttributesList from "@/pages/attributes/list";
import UsersList from "@/pages/users/list";
import BioclimaticZonesList from "@/pages/bioclimatic-zones";
import IsoplethsList from "@/pages/isopleths/list";
import StatesList from "@/pages/states/list.tsx";
import CitiesList from "@/pages/cities/list.tsx";
import SettingsPlaceholder from "@/pages/settings";

function PrivateRoute(props: RouteProps) {
  const { isAuthenticated, isLoading, isError } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Carregando…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center p-6 text-sm text-red-600">
        Falha ao verificar autenticação. Recarregue a página ou tente novamente mais tarde.
      </div>
    );
  }

  if (!isAuthenticated) return <Redirect to="/login" />;

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
  <PrivateRoute path="/constructive-systems" component={ConstructiveSystemsList} />
  <PrivateRoute path="/requirements" component={RequirementsList} />
  <PrivateRoute path="/criteria" component={CriteriaList} />
  <PrivateRoute path="/analyses" component={AnalysesList} />
  <PrivateRoute path="/attributes" component={AttributesList} />
  <PrivateRoute path="/parameters" component={ParametersList} />
      <PrivateRoute path="/bioclimatic-zones" component={BioclimaticZonesList} />
  <PrivateRoute path="/isopleths" component={IsoplethsList} />
      <PrivateRoute path="/states" component={StatesList} />
      <PrivateRoute path="/cities" component={CitiesList} />
      <PrivateRoute path="/users" component={UsersList} />
  <PrivateRoute path="/settings" component={SettingsPlaceholder} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Start background soft refresh to keep session alive while user is active
  useEffect(() => {
    const stop = scheduleAutoRefresh(60_000);
    return () => { stop?.(); };
  }, []);
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
