import { FormEvent, useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { useAuth } from "@/hooks/useAuth";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Settings as SettingsIcon } from "lucide-react";
import { DEFAULT_PAGE_SIZE } from "@/lib/settings";
import { useSaveSettings, useSettingsQuery } from "@/hooks/useSettings";
import { useToast } from "@/hooks/use-toast";
import { showError } from "@/lib/toast-messages";

const MIN_PAGE_SIZE = 5;
const MAX_PAGE_SIZE = 100;

export default function SettingsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  useAuthRedirect();
  const { toast } = useToast();

  const settingsQuery = useSettingsQuery(isAuthenticated);
  const saveSettings = useSaveSettings();

  const [pageSizeInput, setPageSizeInput] = useState<string>(String(DEFAULT_PAGE_SIZE));
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (settingsQuery.data?.pageSize !== undefined) {
      setPageSizeInput(String(settingsQuery.data.pageSize));
      setHasChanges(false);
    }
  }, [settingsQuery.data?.pageSize]);

  const numericPageSize = useMemo(() => {
    const parsed = Number.parseInt(pageSizeInput, 10);
    return Number.isFinite(parsed) ? parsed : NaN;
  }, [pageSizeInput]);

  const isValid = Number.isFinite(numericPageSize)
    && numericPageSize >= MIN_PAGE_SIZE
    && numericPageSize <= MAX_PAGE_SIZE;

  const isLoadingSettings = settingsQuery.isLoading || isLoading;
  const isSaving = saveSettings.isPending;
  const disableSubmit = !hasChanges || !isValid || isSaving;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isValid) {
      showError(toast, `Informe um valor entre ${MIN_PAGE_SIZE} e ${MAX_PAGE_SIZE}.`);
      return;
    }
    try {
      await saveSettings.mutateAsync({ pageSize: numericPageSize });
      setHasChanges(false);
    } catch {
      // handled in mutation
    }
  };

  return (
    <div className="flex h-screen bg-slate-50" data-testid="settings-layout">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title="Configurações"
          description="Personalize a experiência nas páginas de cadastros."
        />
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-3xl mx-auto space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-start gap-3">
                <div className="rounded-xl bg-slate-100 p-2 text-slate-600">
                  <SettingsIcon className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>Preferências gerais</CardTitle>
                  <CardDescription>Controle quantos itens são exibidos nas tabelas de cadastros.</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <form className="space-y-6" onSubmit={handleSubmit}>
                  <div className="space-y-2">
                    <label htmlFor="page-size" className="text-sm font-medium text-slate-700">
                      Itens por página
                    </label>
                    <Input
                      id="page-size"
                      type="number"
                      min={MIN_PAGE_SIZE}
                      max={MAX_PAGE_SIZE}
                      step={1}
                      value={pageSizeInput}
                      onChange={(event) => {
                        setPageSizeInput(event.target.value);
                        setHasChanges(true);
                      }}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      disabled={isLoadingSettings || isSaving}
                      className="max-w-[200px]"
                    />
                    <p className="text-xs text-slate-500">
                      Escolha um valor entre {MIN_PAGE_SIZE} e {MAX_PAGE_SIZE}. O padrão atual é {DEFAULT_PAGE_SIZE} itens por página.
                    </p>
                  </div>
                  <CardFooter className="px-0 py-0">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Button type="submit" disabled={disableSubmit} className="sm:w-auto w-full">
                        {isSaving ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Salvando...
                          </>
                        ) : (
                          "Salvar alterações"
                        )}
                      </Button>
                      <span className="text-xs text-slate-500">
                        {hasChanges ? "Existem alterações não salvas." : "As mudanças são aplicadas imediatamente após salvar."}
                      </span>
                    </div>
                  </CardFooter>
                </form>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
