import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bell, Search } from "lucide-react";
import { ReactNode } from "react";
import { NotificationBell } from "./notification-bell";

interface HeaderProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export default function Header({ title, description, action }: HeaderProps) {
  return (
    <header className="bg-white border-b border-slate-200 px-6 h-20 flex items-center" data-testid="header">
      <div className="w-full flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900" data-testid="text-header-title">
            {title}
          </h2>
          <p className="text-slate-600 mt-1" data-testid="text-header-description">
            {description}
          </p>
        </div>
  <div className="flex items-center space-x-4">
          {/* Action Button */}
          {action}
          
          {/* Notifications */}
          <NotificationBell />
        </div>
      </div>
    </header>
  );
}
