export interface AttributeDefinitionFormData {
  id?: number;
  friendlyName: string;
  sourceTable: string;
  sourceColumn: string;
  dataKind: string;
  valueSource?: string | null;
  valueIdField?: string;
  valueLabelField?: string;
  isActive?: boolean;
}

export const DATA_KINDS = ['boolean','date','numeric','reference','text'] as const;