import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { 
  Building2, 
  LayoutDashboard, 
  FileText, 
  Settings, 
  Calculator,
  User,
  LogOut,
  Cog,
  IdCard
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Edificações', href: '/buildings', icon: Building2 },
  { name: 'Relatórios', href: '/reports', icon: FileText },
  { name: 'Responsáveis Técnicos', href: '/technicians', icon: IdCard },
  { name: 'Sistemas Construtivos', href: '/systems', icon: Settings },
  { name: 'Avaliações', href: '/evaluations', icon: Calculator },
];

const bottomNavigation = [
  { name: 'Perfil', href: '/profile', icon: User },
  { name: 'Configurações', href: '/settings', icon: Cog },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { user } = useAuth();

  const handleLogout = () => {
    window.location.href = '/api/logout';
  };

  return (
  <div className="w-72 bg-white shadow-lg border-r border-slate-200 flex flex-col overflow-y-hidden overscroll-none" data-testid="sidebar">
      {/* Logo Section */}
  <div className="h-20 px-6 flex items-center border-b border-slate-200 bg-white">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <Building2 className="text-primary-foreground text-xl" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900" data-testid="text-logo">PDE Reports</h1>
            <p className="text-sm text-slate-500">v1.0 MVP</p>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-4 space-y-2">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href;
          
          return (
            <Link key={item.name} href={item.href}>
              <Button
                variant={isActive ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start space-x-3 h-12 font-medium transition-colors",
                  isActive 
                    ? "bg-primary/10 text-primary hover:bg-primary/15" 
                    : "text-slate-700 hover:bg-slate-50"
                )}
                data-testid={`nav-${item.name.toLowerCase().replace(' ', '-')}`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.name}</span>
              </Button>
            </Link>
          );
        })}
        
        {/* Divider */}
        <div className="border-t border-slate-200 my-4"></div>
        
        {bottomNavigation.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href;
          
          return (
            <Link key={item.name} href={item.href}>
              <Button
                variant={isActive ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start space-x-3 h-12 font-medium transition-colors",
                  isActive 
                    ? "bg-primary/10 text-primary hover:bg-primary/15" 
                    : "text-slate-700 hover:bg-slate-50"
                )}
                data-testid={`nav-${item.name.toLowerCase()}`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.name}</span>
              </Button>
            </Link>
          );
        })}
      </nav>

      {/* User Profile Section */}
      <div className="p-4 border-t border-slate-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-slate-300 rounded-full flex items-center justify-center overflow-hidden">
            {user?.profileImageUrl ? (
              <img 
                src={user.profileImageUrl} 
                alt="Profile" 
                className="w-full h-full object-cover"
                data-testid="img-user-avatar"
              />
            ) : (
              <User className="w-5 h-5 text-slate-600" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate" data-testid="text-user-name">
              {user?.firstName && user?.lastName 
                ? `${user.firstName} ${user.lastName}` 
                : user?.email || 'Usuário'}
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
    </div>
  );
}
