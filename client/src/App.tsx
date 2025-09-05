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

type PrivateRouteProps = RouteProps & { module?: string };

function PrivateRoute(props: PrivateRouteProps) {
  const { isAuthenticated, isLoading, isError, user } = useAuth();

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

  // Optional: guard by module access when provided
  const required = (props as any).module as string | undefined;
  if (required && user && !(user as any).isAdmin) {
    const allowed = ((user as any).allowedModules || []) as string[];
    if (!allowed.includes(required)) return <Redirect to="/" />;
  }

  return <Route {...props} />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <PrivateRoute path="/" component={Dashboard} />
      <PrivateRoute path="/buildings" component={BuildingList} module="buildings" />
      <PrivateRoute path="/reports" component={ReportList} module="reports" />
      <PrivateRoute path="/technicians" component={TechniciansList} module="technicians" />
      <PrivateRoute path="/typologies" component={TypologiesList} module="typologies" />
      <PrivateRoute path="/noise-classes" component={NoiseClassesList} module="noise-classes" />
      <PrivateRoute path="/aggressiveness-classes" component={AggressivenessClassesList} module="aggressiveness-classes" />
  <PrivateRoute path="/constructive-systems" component={ConstructiveSystemsList} module="constructive-systems" />
  <PrivateRoute path="/requirements" component={RequirementsList} module="requirements" />
  <PrivateRoute path="/criteria" component={CriteriaList} module="criteria" />
  <PrivateRoute path="/analyses" component={AnalysesList} module="analyses" />
  <PrivateRoute path="/attributes" component={AttributesList} module="attributes" />
  <PrivateRoute path="/parameters" component={ParametersList} module="parameters" />
      <PrivateRoute path="/bioclimatic-zones" component={BioclimaticZonesList} module="bioclimatic-zones" />
  <PrivateRoute path="/isopleths" component={IsoplethsList} module="isopleths" />
      <PrivateRoute path="/states" component={StatesList} module="states" />
      <PrivateRoute path="/cities" component={CitiesList} module="cities" />
      <PrivateRoute path="/users" component={UsersList} module="users" />
  <PrivateRoute path="/settings" component={SettingsPlaceholder} module="settings" />
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
