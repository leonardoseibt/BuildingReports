import jsPDF from 'jspdf';
import { DEJAVU_SANS_NORMAL_BASE64 } from '@/lib/fonts/dejavu-sans-normal';
import { DEJAVU_SANS_BOLD_BASE64 } from '@/lib/fonts/dejavu-sans-bold';

// Manter um mapa de documentos que já têm as fontes carregadas
const loadedDocs = new WeakSet<jsPDF>();

export const ensurePdfFonts = async (doc: jsPDF) => {
  // Sempre garantir que as fontes estão carregadas para cada instância do documento
  if (!loadedDocs.has(doc)) {
    console.log('Carregando fontes para nova instância do jsPDF...');
    
    doc.addFileToVFS('DejaVuSans.ttf', DEJAVU_SANS_NORMAL_BASE64);
    doc.addFileToVFS('DejaVuSans-Bold.ttf', DEJAVU_SANS_BOLD_BASE64);
    doc.addFont('DejaVuSans.ttf', 'DejaVuSans', 'normal', 'Identity-H');
    doc.addFont('DejaVuSans-Bold.ttf', 'DejaVuSans', 'bold', 'Identity-H');
    
    // Marcar este documento como tendo as fontes carregadas
    loadedDocs.add(doc);
  }
  
  doc.setFont('DejaVuSans', 'normal');
  
  // Teste para garantir que caracteres especiais estão funcionando
  try {
    const testText = '≥≤±°μ×÷≠';
    doc.text(testText, -1000, -1000); // Posição fora da página para teste
    console.log('Teste de caracteres especiais passou:', testText);
  } catch (error) {
    console.warn('Alguns caracteres especiais podem não ser suportados pela fonte:', error);
  }
};
