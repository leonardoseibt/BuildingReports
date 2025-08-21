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
  Layers2,
  Volume2,
  Shield,
  Globe2,
  ChevronRight,
  ChevronLeft
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

function NavLink({ href, icon: Icon, label, isActive, testId, indent = 0 }: { href: string; icon: any; label: string; isActive: boolean; testId: string; indent?: number; }) {
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

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [open, setOpen] = useState({
    operacoes: false,
    cadastros: false,
    cadPessoas: false,
    cadLocalizacao: false,
    cadParametros: false,
    administracao: false,
  });

  useEffect(() => {
    const handleResize = () => {
      setIsCollapsed(window.innerWidth < 1024);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const toggleSection = (key: keyof typeof open) => {
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleLogout = () => {
    window.location.href = '/api/logout';
  };

  return (
    <div
      className={cn(
        "bg-white shadow-lg border-r border-slate-200 flex flex-col overflow-y-hidden overscroll-none transition-all duration-300",
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
          onClick={() => setIsCollapsed(!isCollapsed)}
          data-testid="button-toggle-sidebar"
        >
          {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </Button>
      </div>

      {/* Navigation Menu */}
      {!isCollapsed && (
        <nav className="flex-1 p-4 space-y-4">
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
            {open.operacoes && (
              <>
                <NavLink
                  href="/buildings"
                  icon={Building2}
                  label="Edificações"
                  isActive={location === '/buildings'}
                  testId="nav-edificações"
                />
                <NavLink
                  href="/reports"
                  icon={FileText}
                  label="Relatórios"
                  isActive={location === '/reports'}
                  testId="nav-relatórios"
                />
              </>
            )}
          </div>

          {/* Cadastros */}
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
                <div>
                  <button
                    className="px-0 w-full text-[11px] text-slate-500 font-medium flex items-center justify-between mb-1"
                    onClick={() => toggleSection('cadPessoas')}
                  >
                    <span>Pessoas e Profissionais</span>
                    <ChevronRight
                      className={cn("w-4 h-4 transition-transform", open.cadPessoas && "rotate-90")}
                    />
                  </button>
                  {open.cadPessoas && (
                    <div className="pl-2">
                      <NavLink
                        href="/technicians"
                        icon={IdCard}
                        label="Responsáveis Técnicos"
                        isActive={location === '/technicians'}
                        testId="nav-responsáveis-técnicos"
                      />
                    </div>
                  )}
                </div>

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
                      <NavLink
                        href="/states"
                        icon={Globe2}
                        label="Estados"
                        isActive={location === '/states'}
                        testId="nav-estados"
                      />
                      <NavLink
                        href="/cities"
                        icon={Globe2}
                        label="Municípios"
                        isActive={location === '/cities'}
                        testId="nav-municípios"
                      />
                      <NavLink
                        href="/bioclimatic-zones"
                        icon={Globe2}
                        label="Zonas Bioclimáticas"
                        isActive={location === '/bioclimatic-zones'}
                        testId="nav-zonas-bioclimáticas"
                      />
                    </div>
                  )}
                </div>

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
                      <NavLink
                        href="/typologies"
                        icon={Layers2}
                        label="Tipos de Uso"
                        isActive={location === '/typologies'}
                        testId="nav-tipos-de-uso"
                      />
                      <NavLink
                        href="/noise-classes"
                        icon={Volume2}
                        label="Classes de Ruído"
                        isActive={location === '/noise-classes'}
                        testId="nav-classes-de-ruído"
                      />
                      <NavLink
                        href="/aggressiveness-classes"
                        icon={Shield}
                        label="Classes de Agressividade"
                        isActive={location === '/aggressiveness-classes'}
                        testId="nav-classes-de-agressividade"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Administração */}
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
                <NavLink
                  href="/users"
                  icon={Users}
                  label="Usuários"
                  isActive={location === '/users'}
                  testId="nav-usuários"
                />
                <NavLink
                  href="/settings"
                  icon={Cog}
                  label="Configurações"
                  isActive={location === '/settings'}
                  testId="nav-configurações"
                />
              </>
            )}
          </div>
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
              <p className="text-xs text-slate-500">Engenheiro Civil</p>
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
