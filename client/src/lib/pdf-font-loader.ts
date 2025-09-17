import jsPDF from 'jspdf';
import { DEJAVU_SANS_NORMAL_BASE64 } from '@/lib/fonts/dejavu-sans-normal';
import { DEJAVU_SANS_BOLD_BASE64 } from '@/lib/fonts/dejavu-sans-bold';

let fontsLoaded = false;

export const ensurePdfFonts = async (doc: jsPDF) => {
  if (!fontsLoaded) {
    doc.addFileToVFS('DejaVuSans.ttf', DEJAVU_SANS_NORMAL_BASE64);
    doc.addFileToVFS('DejaVuSans-Bold.ttf', DEJAVU_SANS_BOLD_BASE64);
    doc.addFont('DejaVuSans.ttf', 'DejaVuSans', 'normal', 'Identity-H');
    doc.addFont('DejaVuSans-Bold.ttf', 'DejaVuSans', 'bold', 'Identity-H');
    fontsLoaded = true;
  }
  doc.setFont('DejaVuSans', 'normal');
};
