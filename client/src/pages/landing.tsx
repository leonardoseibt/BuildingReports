import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, FileText, Calculator, Shield, CheckCircle, Clock } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <Building2 className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">PDEReports</h1>
                <p className="text-sm text-slate-500">Sistema de Relatórios NBR 15575</p>
              </div>
            </div>
            <Button 
              onClick={() => window.location.href = '/api/login'}
              size="lg"
              data-testid="button-login"
            >
              Fazer Login
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-4xl md:text-6xl font-bold text-slate-900 mb-6">
            Geração Automatizada de
            <span className="text-primary block">Relatórios de Desempenho</span>
          </h2>
          <p className="text-xl text-slate-600 mb-8 max-w-3xl mx-auto">
            Sistema profissional para elaboração de relatórios de Perfil de Desempenho da Edificação (PDE) 
            conforme ABNT NBR 15575, com redução de 70% no tempo de elaboração.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              className="text-lg px-8 py-6"
              onClick={() => window.location.href = '/api/login'}
              data-testid="button-get-started"
            >
              Começar Agora
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              className="text-lg px-8 py-6"
              data-testid="button-learn-more"
              onClick={async () => {
                try {
                  // Convenience dev-login: only available when server runs in dev mode without OIDC
                  await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: 'dev@example.com', id: 'local-user' })
                  });
                  window.location.href = '/';
                } catch {}
              }}
            >
              Saiba Mais
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h3 className="text-3xl font-bold text-slate-900 mb-4">
              Funcionalidades Principais
            </h3>
            <p className="text-lg text-slate-600">
              Tudo que você precisa para avaliar o desempenho de edificações
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
                <CardTitle>Cadastro Completo</CardTitle>
                <CardDescription>
                  Sistema completo para cadastro de edificações com determinação automática de zona bioclimática
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardHeader>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                  <Calculator className="w-6 h-6 text-green-600" />
                </div>
                <CardTitle>Cálculos Automatizados</CardTitle>
                <CardDescription>
                  Avaliação automática dos 5 critérios críticos de desempenho conforme NBR 15575
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardHeader>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
                <CardTitle>Relatórios Profissionais</CardTitle>
                <CardDescription>
                  Geração de relatórios executivos padronizados com matriz visual de desempenho
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardHeader>
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
                  <Shield className="w-6 h-6 text-red-600" />
                </div>
                <CardTitle>Segurança Avançada</CardTitle>
                <CardDescription>
                  Sistema com criptografia de dados, auditoria completa e proteção contra vulnerabilidades
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardHeader>
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mb-4">
                  <CheckCircle className="w-6 h-6 text-yellow-600" />
                </div>
                <CardTitle>Conformidade NBR 15575</CardTitle>
                <CardDescription>
                  Algoritmos baseados na norma brasileira para garantia de conformidade técnica
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardHeader>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                  <Clock className="w-6 h-6 text-purple-600" />
                </div>
                <CardTitle>Economia de Tempo</CardTitle>
                <CardDescription>
                  Redução de 70% no tempo de elaboração, de 40-80 horas para apenas 2.5 horas
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h3 className="text-3xl font-bold text-slate-900 mb-6">
                Por que escolher o PDEReports?
              </h3>
              <div className="space-y-6">
                <div className="flex items-start space-x-4">
                  <CheckCircle className="w-6 h-6 text-green-500 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-slate-900">Redução de 95% dos erros</h4>
                    <p className="text-slate-600">Eliminação de erros de cálculo através de algoritmos validados</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <CheckCircle className="w-6 h-6 text-green-500 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-slate-900">Padronização completa</h4>
                    <p className="text-slate-600">Relatórios padronizados seguindo estrutura da NBR 15575</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <CheckCircle className="w-6 h-6 text-green-500 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-slate-900">Interface intuitiva</h4>
                    <p className="text-slate-600">Desenvolvido para ser usado por profissionais não-especialistas</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <CheckCircle className="w-6 h-6 text-green-500 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-slate-900">Auditoria completa</h4>
                    <p className="text-slate-600">Rastreabilidade e versionamento de todos os relatórios</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-8 rounded-2xl">
              <div className="space-y-4">
                <div className="bg-white p-6 rounded-lg shadow-sm">
                  <div className="text-3xl font-bold text-primary mb-2">70%</div>
                  <div className="text-slate-600">Redução no tempo de elaboração</div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-sm">
                  <div className="text-3xl font-bold text-green-600 mb-2">95%</div>
                  <div className="text-slate-600">Eliminação de erros de cálculo</div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-sm">
                  <div className="text-3xl font-bold text-blue-600 mb-2">2.5h</div>
                  <div className="text-slate-600">Tempo médio por relatório</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-900">
        <div className="max-w-4xl mx-auto text-center">
          <h3 className="text-3xl font-bold text-white mb-6">
            Pronto para revolucionar seus relatórios?
          </h3>
          <p className="text-xl text-slate-300 mb-8">
            Junte-se aos profissionais que já economizam tempo e aumentam a precisão
          </p>
          <Button 
            size="lg" 
            className="text-lg px-8 py-6"
            onClick={() => window.location.href = '/api/login'}
            data-testid="button-start-now"
          >
            Começar Agora
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold text-slate-900">PDEReports</span>
          </div>
          <p className="text-slate-600">
            Sistema profissional para geração de relatórios de desempenho de edificações conforme NBR 15575
          </p>
        </div>
      </footer>
    </div>
  );
}
