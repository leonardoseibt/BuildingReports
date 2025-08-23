import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

export default function Login() {
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const queryClient = useQueryClient();

  useEffect(() => {
    if (isAuthenticated) {
      setLocation("/");
    }
  }, [isAuthenticated, setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });
      if (res.ok) {
        toast({ title: "Sucesso", description: "Login realizado" });
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
        toast({
          title: "Erro",
          description: data.message || "Login falhou",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({ title: "Erro", description: "Login falhou", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Entrar</CardTitle>
          <CardDescription>Informe seu email e senha para acessar o sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Button type="submit" className="w-full" data-testid="button-login">
              Entrar
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
