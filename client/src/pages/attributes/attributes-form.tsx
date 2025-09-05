import { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { NotchedField } from '@/components/ui/notched-field';
import { SmartInput } from '@/components/ui/smart-inputs';
import FormHeader from '@/components/ui/form-header';
import { Button } from '@/components/ui/button';
import { AttributeDefinitionFormData, DATA_KINDS } from './types';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean)=> void;
  editItem: AttributeDefinitionFormData | null;
  onSubmit: (data: AttributeDefinitionFormData)=> void;
  loading: boolean;
  tables: string[];
}

export function AttributesFormDialog({ open, onOpenChange, editItem, onSubmit, loading, tables }: Props) {
  const [friendlyName, setFriendlyName] = useState('');
  const [sourceTable, setSourceTable] = useState('');
  const [sourceColumn, setSourceColumn] = useState('');
  const [dataKind, setDataKind] = useState('');
  const [valueSource, setValueSource] = useState('');
  const [valueIdField, setValueIdField] = useState('');
  const [valueLabelField, setValueLabelField] = useState('');
  const [columns, setColumns] = useState<string[]>([]);
  const [columnsRef, setColumnsRef] = useState<string[]>([]);
  const [loadingColumns, setLoadingColumns] = useState(false);
  const [loadingRefColumns, setLoadingRefColumns] = useState(false);

  useEffect(()=> {
    if (editItem) {
      setFriendlyName(editItem.friendlyName||'');
      setSourceTable(editItem.sourceTable||'');
      setSourceColumn(editItem.sourceColumn||'');
      setDataKind(editItem.dataKind||'');
      setValueSource(editItem.valueSource||'');
      setValueIdField(editItem.valueIdField||'');
      setValueLabelField(editItem.valueLabelField||'');
    } else {
      setFriendlyName(''); setSourceTable(''); setSourceColumn(''); setDataKind(''); setValueSource(''); setValueIdField(''); setValueLabelField(''); setColumns([]); setColumnsRef([]);
    }
  }, [editItem, open]);

  useEffect(()=> {
    if (!sourceTable) { setColumns([]); return; }
    let abort=false; (async()=> {
      try { setLoadingColumns(true); const res = await fetch(`/api/metadata/tables/${sourceTable}/columns`, { credentials: 'include' }); if (!res.ok) throw new Error(); const cols:string[] = await res.json(); if (!abort) { setColumns(cols); if (sourceColumn && !cols.includes(sourceColumn)) setSourceColumn(''); }} catch { if (!abort) setColumns([]); } finally { if (!abort) setLoadingColumns(false);} })();
    return ()=> { abort=true; };
  }, [sourceTable]);

  useEffect(()=> { if (dataKind !== 'reference') { setValueSource(''); setColumnsRef([]); }}, [dataKind]);
  useEffect(()=> {
    if (dataKind !== 'reference' || !valueSource) return;
    let abort=false; (async()=> {
      try { setLoadingRefColumns(true); const res = await fetch(`/api/metadata/tables/${valueSource}/columns`, { credentials: 'include' }); if (!res.ok) throw new Error(); const cols:string[] = await res.json(); if (!abort) { setColumnsRef(cols); if (valueIdField && !cols.includes(valueIdField)) setValueIdField(''); if (valueLabelField && !cols.includes(valueLabelField)) setValueLabelField(''); }} catch { if (!abort) setColumnsRef([]); } finally { if (!abort) setLoadingRefColumns(false);} })();
    return ()=> { abort=true; };
  }, [dataKind, valueSource]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload: AttributeDefinitionFormData = {
      id: editItem?.id,
      friendlyName: friendlyName.trim(),
      sourceTable: sourceTable,
      sourceColumn: sourceColumn,
      dataKind: dataKind,
      valueSource: valueSource || null,
      valueIdField: valueIdField || 'id',
      valueLabelField: valueLabelField || 'label'
    };
    onSubmit(payload);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0 overflow-hidden">
        <div className="max-h-[calc(90vh-1rem)] overflow-y-auto my-7 px-7">
          <form onSubmit={submit} className="space-y-6 mt-2" autoComplete="off">
            <FormHeader title={editItem ? 'Editar Atributo' : 'Novo Atributo'} subtitle={editItem ? 'Atualize os dados do atributo.' : 'Cadastre um novo atributo.'} initials={friendlyName.trim().slice(0,2)||null} />
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-12">
                <NotchedField label="Nome" requiredMark>
                  <SmartInput value={friendlyName} onChange={(e)=> setFriendlyName(e.target.value)} required name="friendlyName" className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0" />
                </NotchedField>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-5">
                <NotchedField label="Tabela" requiredMark>
                  <select name="sourceTable" value={sourceTable} onChange={(e)=> setSourceTable(e.target.value)} required className="bg-transparent border-0 shadow-none w-full h-9 text-sm">
                    <option value="" disabled>Selecionar</option>
                    {[...tables].sort((a,b)=> a.localeCompare(b)).map(t=> <option key={t} value={t}>{t}</option>)}
                  </select>
                </NotchedField>
              </div>
              <div className="md:col-span-4">
                <NotchedField label="Coluna" requiredMark>
                  <select name="sourceColumn" value={sourceColumn} onChange={(e)=> setSourceColumn(e.target.value)} required disabled={!sourceTable || loadingColumns} className="bg-transparent border-0 shadow-none w-full h-9 text-sm">
                    <option value="" disabled>{loadingColumns ? 'Carregando...' : 'Selecionar'}</option>
                    {[...columns].sort((a,b)=> a.localeCompare(b)).map(c=> <option key={c} value={c}>{c}</option>)}
                  </select>
                </NotchedField>
              </div>
              <div className="md:col-span-3">
                <NotchedField label="Tipo" requiredMark>
                  <select name="dataKind" value={dataKind} onChange={(e)=> setDataKind(e.target.value)} required className="bg-transparent border-0 shadow-none w-full h-9 text-sm">
                    <option value="" disabled>Selecionar</option>
                    {[...DATA_KINDS].sort((a,b)=> a.localeCompare(b)).map(k=> <option key={k} value={k}>{k}</option>)}
                  </select>
                </NotchedField>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-5">
                <NotchedField label="Fonte Valor (reference)">
                  <select name="valueSource" value={dataKind==='reference'? valueSource: ''} onChange={(e)=> setValueSource(e.target.value)} disabled={dataKind!=='reference'} className="bg-transparent border-0 shadow-none w-full h-9 text-sm">
                    <option value="" disabled>Selecionar</option>
                    {[...tables].sort((a,b)=> a.localeCompare(b)).map(t=> <option key={t} value={t}>{t}</option>)}
                  </select>
                </NotchedField>
              </div>
              <div className="md:col-span-3">
                <NotchedField label="Campo ID">
                  <select name="valueIdField" value={valueIdField} onChange={(e)=> setValueIdField(e.target.value)} disabled={dataKind!=='reference' || !valueSource || loadingRefColumns} className="bg-transparent border-0 shadow-none w-full h-9 text-sm">
                    <option value="" disabled>Selecionar</option>
                    {dataKind==='reference' && columnsRef.sort((a,b)=> a.localeCompare(b)).map(c=> <option key={c} value={c}>{c}</option>)}
                  </select>
                </NotchedField>
              </div>
              <div className="md:col-span-4">
                <NotchedField label="Campo Label">
                  <select name="valueLabelField" value={valueLabelField} onChange={(e)=> setValueLabelField(e.target.value)} disabled={dataKind!=='reference' || !valueSource || loadingRefColumns} className="bg-transparent border-0 shadow-none w-full h-9 text-sm">
                    <option value="" disabled>Selecionar</option>
                    {dataKind==='reference' && columnsRef.sort((a,b)=> a.localeCompare(b)).map(c=> <option key={c} value={c}>{c}</option>)}
                  </select>
                </NotchedField>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={()=> onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={loading}>{editItem ? 'Salvar' : 'Criar'}</Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AttributesFormDialog;