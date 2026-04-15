import { useCallback, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import '../global.css';

function SampleReport() {
  const printRef = useRef(null);
  const [exporting, setExporting] = useState(false);

  const exportPdf = useCallback(async () => {
    const el = printRef.current;
    if (!el) return;

    setExporting(true);
    try {
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save('sample-report.pdf');
    } finally {
      setExporting(false);
    }
  }, []);

  return (
    <div className="container">
      <div className="header-row" style={{ alignItems: 'center', marginBottom: '16px' }}>
        <h1 style={{ margin: 0 }}>Sample Report</h1>
        <button
          type="button"
          className="button-primary"
          onClick={exportPdf}
          disabled={exporting}
          style={{ marginLeft: '16px' }}
        >
          {exporting ? 'Generating PDF…' : 'Download PDF'}
        </button>
      </div>

      <div
        ref={printRef}
        style={{
          backgroundColor: '#fff',
          width: '210mm',
          maxWidth: '100%',
          minHeight: '297mm',
          marginLeft: 'auto',
          marginRight: 'auto',
          padding: '24px',
          boxSizing: 'border-box',
          border: '1px solid #ddd',
          borderRadius: '8px',
        }}
      >
        <p>
          This is a sample report. Use the button above to capture this block as a PDF (A4, multi-page if
          needed).
        </p>
        <p>It is a simple report that displays the data in a table.</p>
        <br />
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Age</th>
              <th>City</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Jane Doe</td>
              <td>34</td>
              <td>Atlanta</td>
            </tr>
            <tr>
              <td>John Smith</td>
              <td>41</td>
              <td>Savannah</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default SampleReport;
