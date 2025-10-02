import React from 'react';
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { buildReportRenderData as loadReportData } from './report-generator';

// Estilos para o documento PDF
const styles = StyleSheet.create({
  page: {
    padding: '18mm 8mm 15mm 8mm',
    fontSize: 10,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
  },
  
  // Building Info (primeira página)
  buildingInfoContainer: {
    marginBottom: 20,
  },
  buildingHeader: {
    backgroundColor: '#1f3a8a',
    color: '#ffffff',
    padding: 12,
    marginBottom: 15,
  },
  buildingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  buildingSubtitle: {
    fontSize: 10,
    opacity: 0.9,
  },
  infoSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1f3a8a',
    marginBottom: 8,
    paddingBottom: 4,
    borderBottom: '2pt solid #e2e8f0',
  },
  infoRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    borderBottom: '0.5pt solid #e2e8f0',
  },
  infoLabel: {
    width: '50%',
    fontSize: 9,
    color: '#475569',
    fontWeight: 'bold',
  },
  infoValue: {
    width: '50%',
    fontSize: 9,
    color: '#1e293b',
  },
  
  // Report Content
  reportSection: {
    marginBottom: 28,
  },
  reportSectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1f3a8a',
    marginBottom: 18,
    paddingBottom: 6,
    borderBottom: '2pt solid #3b82f6',
  },
  
  // Criterion
  criterionContainer: {
    marginBottom: 16,
  },
  criterionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 10,
    paddingLeft: 8,
    paddingVertical: 6,
    backgroundColor: '#eff6ff',
    borderLeft: '3pt solid #3b82f6',
  },
  
  // Analysis
  analysisContainer: {
    marginBottom: 12,
  },
  analysisHeader: {
    backgroundColor: '#e6ecf9',
    color: '#1f3a8a',
    padding: '9pt 12pt',
    fontSize: 11,
    fontWeight: 'bold',
    borderWidth: 1,
    borderColor: '#d5d9e2',
  },
  analysisColumns: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    padding: '7pt 10pt',
    fontSize: 9,
    fontWeight: 'bold',
    borderWidth: 1,
    borderColor: '#d5d9e2',
    borderTopWidth: 0,
  },
  analysisLevelLabel: {
    width: '20%',
    color: '#475569',
  },
  
  // Table
  table: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#d5d9e2',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f1f4fb',
    borderBottomWidth: 1,
    borderColor: '#d5d9e2',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#d5d9e2',
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  headerCell: {
    padding: '9pt 10pt',
    fontSize: 10.5,
    fontWeight: 'bold',
    color: '#1f2d4f',
    borderRightWidth: 1,
    borderColor: '#d5d9e2',
    textTransform: 'uppercase',
  },
  headerCellLast: {
    borderRightWidth: 0,
  },
  paramCell: {
    flex: 1,
    padding: '8pt 10pt',
    fontSize: 9,
    color: '#1e293b',
    borderRightWidth: 1,
    borderColor: '#d5d9e2',
  },
  valueCell: {
    width: 50,
    padding: '8pt 6pt',
    fontSize: 9,
    color: '#1e293b',
    textAlign: 'center',
    borderRightWidth: 1,
    borderColor: '#d5d9e2',
  },
  cellLast: {
    borderRightWidth: 0,
  },
  paramLabel: {
    fontWeight: 'bold',
    marginBottom: 3,
  },
  paramObservation: {
    fontSize: 8,
    color: '#64748b',
    fontStyle: 'italic',
  },
});

const levelLabels: Record<string, string> = {
  minimum: 'Min',
  intermediate: 'Int',
  superior: 'Sup'
};

const levelOrder: Array<'minimum' | 'intermediate' | 'superior'> = ['minimum', 'intermediate', 'superior'];

function normalizeText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function formatWithSeparators(value: string | null | undefined): string {
  if (!value) return '';
  return normalizeText(value).replace(/\r?\n/g, ' • ');
}

// Componentes do documento PDF

const BuildingInfo: React.FC<{ context: any }> = ({ context }) => {
  const buildingName = normalizeText(context.building?.name);
  const fallbackId = context.report.buildingId ?? context.building.id;
  const displayName = buildingName || (fallbackId ? `Edificacao ID ${fallbackId}` : 'Edificacao');
  
  const buildingInfoSections = context.buildingInfoSections || [];

  return (
    <View style={styles.buildingInfoContainer} wrap={false}>
      <View style={styles.buildingHeader}>
        <Text style={styles.buildingTitle}>{displayName}</Text>
        <Text style={styles.buildingSubtitle}>
          Relatorio de Desempenho - Gerado em {new Date(context.report.generatedAt || Date.now()).toLocaleDateString('pt-BR')}
        </Text>
      </View>

      {buildingInfoSections.map((section: any, idx: number) => (
        <View key={idx} style={styles.infoSection} wrap={false}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          {section.rows.map((row: any, rowIdx: number) => (
            <View key={rowIdx} style={styles.infoRow}>
              <Text style={styles.infoLabel}>{row.label}:</Text>
              <Text style={styles.infoValue}>
                {row.value} {row.unit && row.unit}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
};

const ParameterRow: React.FC<{ parameter: any; selectedLevels: string[]; isLast: boolean }> = ({ parameter, selectedLevels, isLast }) => {
  const description = formatWithSeparators(parameter.description);
  const observation = formatWithSeparators(parameter.observation);
  const rowStyle = isLast ? [styles.tableRow, styles.tableRowLast] : [styles.tableRow];

  return (
    <View style={rowStyle} wrap={false}>
      <View style={styles.paramCell}>
        <Text style={styles.paramLabel}>{description || '-'}</Text>
        {observation && <Text style={styles.paramObservation}>{observation}</Text>}
      </View>
      <View style={styles.valueCell}>
        <Text>{normalizeText(parameter.unit) || '-'}</Text>
      </View>
      {levelOrder.map((level, idx) => {
        if (!selectedLevels.includes(level)) return null;
        const isLastLevel = idx === levelOrder.length - 1 || !selectedLevels.includes(levelOrder[idx + 1]);
        const value = (parameter as any)[`${level}Value`];
        const cellStyle = isLastLevel ? [styles.valueCell, styles.cellLast] : [styles.valueCell];
        return (
          <View key={level} style={cellStyle}>
            <Text>{normalizeText(value) || '-'}</Text>
          </View>
        );
      })}
    </View>
  );
};

const AnalysisTable: React.FC<{ analysis: any }> = ({ analysis }) => {
  const analysisName = normalizeText(analysis.name);
  const selectedLevels = analysis.selectedLevels || [];
  const levelsDisplay = selectedLevels.map((l: string) => levelLabels[l] || l).join(', ');

  return (
    <View style={styles.analysisContainer}>
      <View style={styles.analysisHeader}>
        <Text>{analysisName}</Text>
      </View>
      <View style={styles.analysisColumns}>
        <Text style={{ width: '60%' }}>Niveis de desempenho: {levelsDisplay}</Text>
      </View>
      
      <View style={styles.table}>
        <View style={styles.tableHeader} fixed>
          <Text style={styles.headerCell}>Parametro</Text>
          <Text style={styles.headerCell}>UN</Text>
          {selectedLevels.map((level: string, idx: number) => {
            const isLast = idx === selectedLevels.length - 1;
            const headerStyle = isLast ? [styles.headerCell, styles.headerCellLast] : [styles.headerCell];
            return (
              <Text key={level} style={headerStyle}>
                {levelLabels[level]}
              </Text>
            );
          })}
        </View>
        
        {analysis.parameters && analysis.parameters.map((param: any, idx: number) => (
          <ParameterRow
            key={param.id}
            parameter={param}
            selectedLevels={selectedLevels}
            isLast={idx === analysis.parameters.length - 1}
          />
        ))}
      </View>
    </View>
  );
};

const CriterionSection: React.FC<{ criterion: any }> = ({ criterion }) => {
  const criterionName = normalizeText(criterion.name);

  return (
    <View style={styles.criterionContainer}>
      <Text style={styles.criterionTitle}>{criterionName}</Text>
      {criterion.analyses && criterion.analyses.map((analysis: any) => (
        <AnalysisTable key={analysis.id} analysis={analysis} />
      ))}
    </View>
  );
};

const RequirementSection: React.FC<{ requirement: any }> = ({ requirement }) => {
  const requirementName = normalizeText(requirement.name);

  return (
    <View style={styles.reportSection} wrap={false}>
      <Text style={styles.reportSectionTitle}>{requirementName}</Text>
      {requirement.criteria && requirement.criteria.map((criterion: any) => (
        <CriterionSection key={criterion.id} criterion={criterion} />
      ))}
    </View>
  );
};

const ReportDocument: React.FC<{ context: any }> = ({ context }) => {
  return (
    <Document>
      {/* Primeira página - Dados da edificação */}
      <Page size="A4" style={styles.page}>
        <BuildingInfo context={context} />
      </Page>

      {/* Páginas seguintes - Relatório */}
      <Page size="A4" style={styles.page}>
        {context.sections && context.sections.map((requirement: any) => (
          <RequirementSection key={requirement.id} requirement={requirement} />
        ))}
      </Page>
    </Document>
  );
};

export async function generateReportPDF(reportId: number, userId: number) {
  const { context, filename } = await loadReportData(reportId, userId);
  
  return {
    document: <ReportDocument context={context} />,
    filename
  };
}
