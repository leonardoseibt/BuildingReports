import { Link, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Building2,
  LayoutDashboard,
  FileText,
  User,
  Users,
  LogOut,
  Cog,
  IdCard,
  LayoutGrid,
  Volume2,
  AlertTriangle,
  Hammer,
  ListChecks,
  Target,
  Map,
  Sun,
  Wind,
  Beaker,
  Database,
  ChevronRight,
  ChevronLeft
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

function NavLink({ href, icon: Icon, label, isActive, testId, indent = 0, visible = true }: { href: string; icon: any; label: string; isActive: boolean; testId: string; indent?: number; visible?: boolean; }) {
  if (!visible) return null;
  return (
    <Link href={href}>
      <Button
        variant={isActive ? "secondary" : "ghost"}
        className={cn(
          "w-full justify-start space-x-3 h-10 font-medium transition-colors",
          isActive ? "bg-primary/10 text-primary hover:bg-primary/15" : "text-slate-700 hover:bg-slate-50",
          indent ? `pl-${indent}` : ""
        )}
        data-testid={testId}
      >
        <Icon className="w-5 h-5" />
        <span>{label}</span>
      </Button>
    </Link>
  );
}

export default function Sidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const hasAccess = (key: string) => {
    if (!user) return false;
    return (user as any).isAdmin || ((user as any).allowedModules || []).includes(key);
  };

  // Compute which section groups should be shown based on module access
  const showOperacoes = hasAccess('reports');
  const showCadPessoas = hasAccess('buildings') || hasAccess('technicians');
  const showCadLocalizacao = hasAccess('states') || hasAccess('cities') || hasAccess('bioclimatic-zones') || hasAccess('isopleths');
  const showCadAuxiliares = hasAccess('typologies') || hasAccess('noise-classes') || hasAccess('aggressiveness-classes') || hasAccess('constructive-systems');
  const showCadParametros = hasAccess('requirements') || hasAccess('criteria') || hasAccess('analyses') || hasAccess('attributes') || hasAccess('parameters');
  const showAdministracao = hasAccess('users') || hasAccess('settings');

  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("sidebar-collapsed");
      if (window.innerWidth < 1024) return true;
      return stored ? JSON.parse(stored) : false;
    }
    return false;
  });

  const initialOpen = {
    operacoes: true,
    cadastros: true,
    cadPessoas: true,
    cadLocalizacao: true,
    cadParametros: true,
    cadAuxiliares: true,
    administracao: true,
  };

  const [open, setOpen] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("sidebar-open");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          return { ...initialOpen, ...parsed };
        } catch {
          return initialOpen;
        }
      }
    }
    return initialOpen;
  });

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsCollapsed(true);
      } else {
        const stored = localStorage.getItem("sidebar-collapsed");
        setIsCollapsed(stored ? JSON.parse(stored) : false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    localStorage.setItem("sidebar-open", JSON.stringify(open));
  }, [open]);

  const toggleSidebar = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    localStorage.setItem("sidebar-collapsed", JSON.stringify(next));
  };

  const toggleSection = (key: keyof typeof open) => {
    setOpen((prev: typeof open) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleLogout = () => {
    window.location.href = '/api/logout';
  };

  // Permission checks for each module
  const canReports = hasAccess("reports");
  const canBuildings = hasAccess("buildings");
  const canTechnicians = hasAccess("technicians");
  const canStates = hasAccess("states");
  const canCities = hasAccess("cities");
  const canBioclimatic = hasAccess("bioclimatic-zones");
  const canIsopleths = hasAccess("isopleths");
  const canTypologies = hasAccess("typologies");
  const canNoiseClasses = hasAccess("noise-classes");
  const canAggressivenessClasses = hasAccess("aggressiveness-classes");
  const canConstructiveSystems = hasAccess("constructive-systems");
  const canRequirements = hasAccess("requirements");
  const canCriteria = hasAccess("criteria");
  const canAnalyses = hasAccess("analyses");
  const canAttributes = hasAccess("attributes");
  const canParameters = hasAccess("parameters");
  const canUsers = hasAccess("users");
  const canSettings = hasAccess("settings");

  // Visibility controls for groups
  const showOperacoes = canReports;
  const showCadPessoas = canBuildings || canTechnicians;
  const showCadLocalizacao =
    canStates || canCities || canBioclimatic || canIsopleths;
  const showCadAuxiliares =
    canTypologies || canNoiseClasses || canAggressivenessClasses || canConstructiveSystems;
  const showCadParametros =
    canRequirements || canCriteria || canAnalyses || canAttributes || canParameters;
  const showCadastros =
    showCadPessoas || showCadLocalizacao || showCadAuxiliares || showCadParametros;
  const showAdministracao = canUsers || canSettings;

  return (
    <div
      className={cn(
        "bg-white shadow-lg border-r border-slate-200 flex flex-col transition-all duration-300",
        isCollapsed ? "w-16" : "w-72"
      )}
      data-testid="sidebar"
    >
      {/* Logo Section */}
      <div className="h-20 px-6 flex items-center border-b border-slate-200 bg-white">
        {!isCollapsed && (
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <Building2 className="text-primary-foreground text-xl" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900" data-testid="text-logo">
                PDE Reports
              </h1>
              <p className="text-sm text-slate-500">v1.0 MVP</p>
            </div>
          </div>
        )}
        {isCollapsed && (
          <div className="flex items-center justify-center w-full">
            <Building2 className="text-primary w-8 h-8" />
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto"
          onClick={toggleSidebar}
          data-testid="button-toggle-sidebar"
        >
          {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </Button>
      </div>

      {/* Navigation Menu */}
      {!isCollapsed && (
        <nav className="flex-1 p-4 space-y-4 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
          {/* Dashboard (standalone) */}
          <div>
            <NavLink
              href="/"
              icon={LayoutDashboard}
              label="Dashboard"
              isActive={location === '/'}
              testId="nav-dashboard"
            />
          </div>
          {/* Operações */}
          {showOperacoes && (
            <div>
              <button
                className="px-2 w-full text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 flex items-center justify-between"
                onClick={() => toggleSection('operacoes')}
              >
                <span>Operações</span>
                <ChevronRight
                  className={cn("w-4 h-4 transition-transform", open.operacoes && "rotate-90")}
                />
              </button>
              {open.operacoes && canReports && (
                <NavLink
                  href="/reports"
                  icon={FileText}
                  visible={hasAccess('reports')}
                  label="Relatórios"
                  isActive={location === '/reports'}
                  testId="nav-relatórios"
                />
              )}
            </div>
          )}

          {/* Cadastros */}
          {showCadastros && (
            <div>
              <button
                className="px-2 w-full text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 flex items-center justify-between"
                onClick={() => toggleSection('cadastros')}
              >
                <span>Cadastros</span>
                <ChevronRight
                  className={cn("w-4 h-4 transition-transform", open.cadastros && "rotate-90")}
                />
              </button>
              {open.cadastros && (
                <div className="pl-2 space-y-2">
                  {/* Edificações e Profissionais */}
                  {showCadPessoas && (
                    <div>
                      <button
                        className="px-0 w-full text-[11px] text-slate-500 font-medium flex items-center justify-between mb-1"
                        onClick={() => toggleSection('cadPessoas')}
                      >
                        <span>Edificações e Profissionais</span>
                        <ChevronRight
                          className={cn("w-4 h-4 transition-transform", open.cadPessoas && "rotate-90")}
                        />
                      </button>
                      {open.cadPessoas && (
                        <div className="pl-2 space-y-0.5">
                          {canBuildings && (
                            <NavLink
                              href="/buildings"
                              icon={Building2}
                              label="Edificações"
                              isActive={location === '/buildings'}
                              testId="nav-edificações"
                            />
                          )}
                          {canTechnicians && (
                            <NavLink
                              href="/technicians"
                              icon={IdCard}
                              label="Responsáveis Técnicos"
                              isActive={location === '/technicians'}
                              testId="nav-responsáveis-técnicos"
                            />
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Localização */}
                  {showCadLocalizacao && (
                    <div>
                      <button
                        className="px-0 w-full text-[11px] text-slate-500 font-medium flex items-center justify-between mb-1 mt-1"
                        onClick={() => toggleSection('cadLocalizacao')}
                      >
                        <span>Localização</span>
                        <ChevronRight
                          className={cn("w-4 h-4 transition-transform", open.cadLocalizacao && "rotate-90")}
                        />
                      </button>
                      {open.cadLocalizacao && (
                        <div className="pl-2 space-y-0.5">
                          {canStates && (
                            <NavLink
                              href="/states"
                              icon={Map}
                              label="Estados"
                              isActive={location === '/states'}
                              testId="nav-estados"
                            />
                          )}
                          {canCities && (
                            <NavLink
                              href="/cities"
                              icon={Building2}
                              label="Municípios"
                              isActive={location === '/cities'}
                              testId="nav-municípios"
                            />
                          )}
                          {canBioclimatic && (
                            <NavLink
                              href="/bioclimatic-zones"
                              icon={Sun}
                              label="Zonas Bioclimáticas"
                              isActive={location === '/bioclimatic-zones'}
                              testId="nav-zonas-bioclimáticas"
                            />
                          )}
                          {canIsopleths && (
                            <NavLink
                              href="/isopleths"
                              icon={Wind}
                              label="Isopletas"
                              isActive={location === '/isopleths'}
                              testId="nav-isopletas"
                            />
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Auxiliares */}
                  {showCadAuxiliares && (
                    <div>
                      <button
                        className="px-0 w-full text-[11px] text-slate-500 font-medium flex items-center justify-between mb-1 mt-1"
                        onClick={() => toggleSection('cadAuxiliares')}
                      >
                        <span>Auxiliares</span>
                        <ChevronRight
                          className={cn("w-4 h-4 transition-transform", open.cadAuxiliares && "rotate-90")}
                        />
                      </button>
                      {open.cadAuxiliares && (
                        <div className="pl-2 space-y-0.5">
                          {canTypologies && (
                            <NavLink
                              href="/typologies"
                              icon={LayoutGrid}
                              label="Tipos de Uso"
                              isActive={location === '/typologies'}
                              testId="nav-tipos-de-uso"
                            />
                          )}
                          {canNoiseClasses && (
                            <NavLink
                              href="/noise-classes"
                              icon={Volume2}
                              label="Classes de Ruído"
                              isActive={location === '/noise-classes'}
                              testId="nav-classes-de-ruído"
                            />
                          )}
                          {canAggressivenessClasses && (
                            <NavLink
                              href="/aggressiveness-classes"
                              icon={AlertTriangle}
                              label="Classes de Agressividade"
                              isActive={location === '/aggressiveness-classes'}
                              testId="nav-classes-de-agressividade"
                            />
                          )}
                          {canConstructiveSystems && (
                            <NavLink
                              href="/constructive-systems"
                              icon={Hammer}
                              label="Sistemas Construtivos"
                              isActive={location === '/constructive-systems'}
                              testId="nav-sistemas-construtivos"
                            />
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Parâmetros */}
                  {showCadParametros && (
                    <div>
                      <button
                        className="px-0 w-full text-[11px] text-slate-500 font-medium flex items-center justify-between mb-1 mt-1"
                        onClick={() => toggleSection('cadParametros')}
                      >
                        <span>Parâmetros</span>
                        <ChevronRight
                          className={cn("w-4 h-4 transition-transform", open.cadParametros && "rotate-90")}
                        />
                      </button>
                      {open.cadParametros && (
                        <div className="pl-2 space-y-0.5">
                          {canRequirements && (
                            <NavLink
                              href="/requirements"
                              icon={ListChecks}
                              label="Requisitos"
                              isActive={location === '/requirements'}
                              testId="nav-requisitos-parametros"
                            />
                          )}
                          {canCriteria && (
                            <NavLink
                              href="/criteria"
                              icon={Target}
                              label="Critérios"
                              isActive={location === '/criteria'}
                              testId="nav-criterios"
                            />
                          )}
                          {canAnalyses && (
                            <NavLink
                              href="/analyses"
                              icon={Beaker}
                              label="Análises"
                              isActive={location === '/analyses'}
                              testId="nav-analises"
                            />
                          )}
                          {canAttributes && (
                            <NavLink
                              href="/attributes"
                              icon={Database}
                              label="Atributos"
                              isActive={location === '/attributes'}
                              testId="nav-atributos"
                            />
                          )}
                          {canParameters && (
                            <NavLink
                              href="/parameters"
                              icon={ListChecks}
                              label="Parâmetros"
                              isActive={location === '/parameters'}
                              testId="nav-parametros"
                            />
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Administração */}
          {showAdministracao && (
            <div>
              <button
                className="px-2 w-full text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 flex items-center justify-between"
                onClick={() => toggleSection('administracao')}
              >
                <span>Administração</span>
                <ChevronRight
                  className={cn("w-4 h-4 transition-transform", open.administracao && "rotate-90")}
                />
              </button>
              {open.administracao && (
                <>
                  {canUsers && (
                    <NavLink
                      href="/users"
                      icon={Users}
                      label="Usuários"
                      isActive={location === '/users'}
                      testId="nav-usuários"
                    />
                  )}
                  {canSettings && (
                    <NavLink
                      href="/settings"
                      icon={Cog}
                      label="Configurações"
                      isActive={location === '/settings'}
                      testId="nav-configurações"
                    />
                  )}
                </>
              )}
            </div>
          )}
        </nav>
      )}

      {/* User Profile Section */}
      {!isCollapsed && (
        <div className="p-4 border-t border-slate-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-slate-300 rounded-full flex items-center justify-center overflow-hidden">
              <User className="w-5 h-5 text-slate-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="text-sm font-medium text-slate-900 truncate"
                data-testid="text-user-name"
              >
                {user?.fullName || user?.email || 'Usuário'}
              </p>
              {/* Removed static role subtitle */}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-slate-400 hover:text-slate-600 p-2"
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
