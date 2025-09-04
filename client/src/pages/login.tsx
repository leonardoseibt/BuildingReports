import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { showSuccess, showError } from "@/lib/toast-messages";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, clearCsrfToken } from "@/lib/queryClient";
import { Mail, Lock, Eye, EyeOff, Loader2, Building2, ArrowRight } from "lucide-react";

export default function Login() {
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  // const isDev = import.meta.env.DEV; // dev login button removed per request
  const queryClient = useQueryClient();

  useEffect(() => {
    if (isAuthenticated) {
      setLocation("/");
    }
  }, [isAuthenticated, setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const res = await apiRequest("POST", "/api/login", { email, password });
      if (res.ok) {
        // Regenerating the session on login invalidates previous CSRF secrets; clear cached token
        clearCsrfToken();
        showSuccess(toast, "Login realizado.");
        await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
        await queryClient.refetchQueries({ queryKey: ["/api/auth/user"] });
        // fallback: caso o roteamento SPA não ocorra (ex: estado interno ainda carregando), força navegação
        setTimeout(() => {
          if (window.location.pathname !== "/") {
            window.location.assign("/");
          }
        }, 150);
        setLocation("/");
      } else {
        const data = await res.json().catch(() => ({}));
        showError(toast, data.message || "Login falhou");
      }
    } catch (err) {
      showError(toast, "Login falhou");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 p-4">
      <Card className="w-full max-w-md shadow-lg border-slate-200/60">
        <CardHeader className="pb-4 text-center">
          <CardTitle className="text-2xl flex flex-col items-center gap-3">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-sm">
              <Building2 className="w-7 h-7" />
            </span>
            <span className="tracking-tight font-semibold">PDE Reports</span>
          </CardTitle>
          <CardDescription>Acesse com suas credenciais para continuar</CardDescription>
        </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6" autoComplete="off">
              {/* Email */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="email"
                    placeholder="voce@empresa.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="pl-9"
                  />
                </div>
              </div>
              {/* Password */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Senha</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pl-9 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {/* Remember + Forgot */}
              <div className="flex items-center justify-between gap-4 text-sm">
                <label className="inline-flex items-center gap-2 select-none cursor-pointer text-slate-600">
                  <Checkbox checked={remember} onCheckedChange={(v:any)=> setRemember(!!v)} />
                  <span>Lembrar</span>
                </label>
                <span className="text-slate-400 italic text-xs">(recuperação de senha em breve)</span>
              </div>
              {/* Submit */}
              <Button
                type="submit"
                className="w-full h-11 font-medium flex items-center justify-center gap-2"
                data-testid="button-login"
                disabled={submitting}
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Entrar</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </form>
            <div className="pt-2 text-center text-xs text-slate-400">&copy; {new Date().getFullYear()} PDE Reports</div>
          </CardContent>
      </Card>
    </div>
  );
}
