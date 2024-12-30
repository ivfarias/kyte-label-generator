'use client'

import { useState, useEffect } from 'react';
import JsBarcode from 'jsbarcode'
import { QRCodeSVG } from 'qrcode.react'
import './App.css';
import ReactDOM from 'react-dom';

const paperTypes = [
  { name: 'A4 65 Etiquetas (38.1 x 21.2 mm)', width: '1.5in', height: '0.83in', columns: 3, rows: 11 },
  { name: 'A4 21 Etiquetas (63.5 x 38.1 mm)', width: '2.5in', height: '1.5in', columns: 3, rows: 7 },
  { name: 'A4 10 Etiquetas (99.1 x 57 mm)', width: '3.9in', height: '2.25in', columns: 2, rows: 5 },
  { name: 'A4 Página Toda (210 x 297 mm)', width: '8.27in', height: '11.7in', columns: 1, rows: 1 },
  { name: 'Personalizado', width: '', height: '', columns: 1, rows: 1 },
]

const barcodeTypes = ['CODE128', 'EAN13', 'UPC', 'EAN8', 'QR'];

export default function BarcodeGenerator() {
  const [input, setInput] = useState('')
  const [barcodeType, setBarcodeType] = useState('CODE128')
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([])
  const [bulkInput, setBulkInput] = useState('')
  const [paperType, setPaperType] = useState(paperTypes[0])
  const [customPaper, setCustomPaper] = useState({ width: '', height: '', columns: '', rows: '' })
  const [showBulkDialog, setShowBulkDialog] = useState(false)

  useEffect(() => {
    if (paperType.name === 'Custom') {
      setPaperType(prevState => ({
        ...prevState,
        ...customPaper,
        columns: Number(customPaper.columns) || 1,
        rows: Number(customPaper.rows) || 1
      }));
    }
  }, [customPaper, paperType.name]);

  useEffect(() => {
    const detectedType = detectBarcodeType(input);
    setBarcodeType(detectedType);
  }, [input]);

  const detectBarcodeType = (input: string) => {
    if (/^\d{13}$/.test(input)) return 'EAN13';
    if (/^\d{12}$/.test(input)) return 'UPC';
    if (/^\d{8}$/.test(input)) return 'EAN8';
    if (/^[A-Z0-9]+$/.test(input)) return 'CODE128';
    return 'QR';
  };

  const generateBarcode = (code: string, type: string) => {
    const barcodeFormat = type === 'GENERAL' ? 'CODE128' : type;

    if (barcodeFormat === 'QR') {
      return new Promise<string>((resolve) => {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const qr = <QRCodeSVG value={code} size={200} />;
        ReactDOM.render(qr, svg, () => {
          const svgString = new XMLSerializer().serializeToString(svg);
          resolve(`data:image/svg+xml;base64,${btoa(svgString)}`);
        });
      });
    } else {
      return new Promise<string>((resolve, reject) => {
        try {
          const canvas = document.createElement('canvas');
          JsBarcode(canvas, code, { format: barcodeFormat });
          resolve(canvas.toDataURL('image/png'));
        } catch (error) {
          reject(error);
        }
      });
    }
  };

  const handleGenerate = async () => {
    try {
      if (!input.trim()) {
        alert('Please enter a valid input');
        return;
      }
      const base64 = await generateBarcode(input, barcodeType);
      setGeneratedCodes([base64]);
    } catch (error) {
      console.error('Error generating barcode:', error);
      alert('Failed to generate barcode. Please check your input and try again.');
    }
  }

  const handleBulkGenerate = async () => {
    const codes = bulkInput.split(',').map(code => code.trim()).filter(code => code !== '');
    if (codes.length === 0) {
      alert('Please enter valid codes separated by commas');
      return;
    }
    try {
      const generatedBarcodes = await Promise.all(
        codes.map(async (code) => {
          const type = detectBarcodeType(code);
          return generateBarcode(code, type);
        })
      );
      setGeneratedCodes(generatedBarcodes);
      setShowBulkDialog(false);
    } catch (error) {
      console.error('Error generating barcodes:', error);
      alert('Failed to generate one or more barcodes. Please check your input and try again.');
    }
  }

  const downloadBarcode = (index: number) => {
    const link = document.createElement('a');
    const code = generatedCodes[index];
    const isQR = code.startsWith('data:image/svg+xml');
    const fileExtension = isQR ? 'svg' : 'png';
    link.href = code;
    link.download = `Barcode_${Date.now()}.${fileExtension}`;
    link.click();
  }

  const printBarcodes = () => {
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Imprimir códigos de barras e etiquetas</title>
            <style>
              body { margin: 0; padding: 0; }
              .label-container {
                display: grid;
                grid-template-columns: repeat(${paperType.columns}, 1fr);
                grid-gap: 0;
              }
              .label {
                width: ${paperType.width};
                height: ${paperType.height};
                display: flex;
                justify-content: center;
                align-items: center;
                page-break-inside: avoid;
              }
              .label img {
                max-width: 100%;
                max-height: 100%;
              }
              @media print {
                @page { margin: 0; }
                body { margin: 0.5cm; }
              }
            </style>
          </head>
          <body>
            <div class="label-container">
              ${generatedCodes.map(code => `
                <div class="label">
                  <img src="${code}" alt="Código de Barras">
                </div>
              `).join('')}
            </div>
          </body>
        </html>
      `)
      printWindow.document.close()
      printWindow.print()
    }
  }

  return (
    <div className="w-full max-w-3xl mx-auto bg-white shadow-md rounded-lg overflow-hidden">
      <div className="p-6">
        <div className="flex justify-center items-center h-full">
          <img className="size-10 mb-4" src="/logo_green.svg" alt="Logo" />
        </div>
        <h2 className="text-3xl font-bold text-gray-700 mb-2">Gerador de Códigos de Barras e Etiquetas</h2>
        <p className="text-gray-500 text-sm mb-6">⚠ Preencha as informações abaixo para criar uma etiqueta. Caso deseje criar várias, aperte o botão "Gerar vários"</p>
        <div className="space-y-4">
          <div>
            <label htmlFor="input" className="block text-base font-medium text-gray-700 mb-2 justify-self-start">Escreva o código do seu produto aqui</label>
            <input
              id="input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Digite seu código de barras"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-emerald-500 focus:border-emerald-600 bg-[#F7F7F8] text-gray-700"
            />
          </div>
          <div>
            <label htmlFor="barcodeType" className="block text-base font-medium text-gray-700 mb-2 justify-self-start">Selecione o tipo de código de barras</label>
            <select
              id="barcodeType"
              value={barcodeType}
              onChange={(e) => setBarcodeType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 bg-[#F7F7F8] text-gray-700"
            >
              {barcodeTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={handleGenerate}
              className="px-4 py-2 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            >
              Gerar um
            </button>
            <button
              onClick={() => setShowBulkDialog(true)}
              className="px-4 py-2 bg-emerald-400 text-white rounded-md hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            >
              Gerar vários
            </button>
          </div>
          <div>
            <label htmlFor="paperType" className="block text-base font-medium text-gray-700 mb-2 justify-self-start">Tipo de papel</label>
            <select
              id="paperType"
              value={paperType.name}
              onChange={(e) => setPaperType(paperTypes.find(p => p.name === e.target.value) || paperTypes[0])}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 bg-[#F7F7F8] text-gray-700"
            >
              {paperTypes.map((type) => (
                <option key={type.name} value={type.name}>{type.name}</option>
              ))}
            </select>
          </div>
          {paperType.name === 'Custom' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="customWidth" className="block text-sm font-medium text-gray-700 mb-1">Largura (in)</label>
                <input
                  id="customWidth"
                  type="text"
                  value={customPaper.width}
                  onChange={(e) => setCustomPaper({ ...customPaper, width: e.target.value })}
                  placeholder="Width in inches"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 bg-[#F7F7F8]"
                />
              </div>
              <div>
                <label htmlFor="customHeight" className="block text-sm font-medium text-gray-700 mb-1">Altura (in)</label>
                <input
                  id="customHeight"
                  type="text"
                  value={customPaper.height}
                  onChange={(e) => setCustomPaper({ ...customPaper, height: e.target.value })}
                  placeholder="Height in inches"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 bg-[#F7F7F8]"
                />
              </div>
              <div>
                <label htmlFor="customColumns" className="block text-sm font-medium text-gray-700 mb-1">Colunas</label>
                <input
                  id="customColumns"
                  type="text"
                  value={customPaper.columns}
                  onChange={(e) => setCustomPaper({ ...customPaper, columns: e.target.value })}
                  placeholder="Number of columns"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 bg-[#F7F7F8]"
                />
              </div>
              <div>
                <label htmlFor="customRows" className="block text-sm font-medium text-gray-700 mb-1">Linhas</label>
                <input
                  id="customRows"
                  type="text"
                  value={customPaper.rows}
                  onChange={(e) => setCustomPaper({ ...customPaper, rows: e.target.value })}
                  placeholder="Number of rows"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 bg-[#F7F7F8]"
                />
              </div>
            </div>
          )}
          <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
            {generatedCodes.map((code, index) => (
              <div key={index} className="flex flex-col items-center">
                <img src={code} alt={`Barcode ${index + 1}`} className="max-w-full h-auto" />
                <button
                  onClick={() => downloadBarcode(index)}
                  className="mt-2 px-3 py-1 bg-emerald-600 text-white text-sm rounded-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                >
                  Baixar
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="bg-gray-50 px-6 py-3 flex justify-end">
        <button
          onClick={printBarcodes}
          disabled={generatedCodes.length === 0}
          className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Imprimir
        </button>
      </div>
      {showBulkDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg shadow-xl w-96">
            <h3 className="text-lg font-semibold mb-4">Gerar vários códigos de barras</h3>
            <textarea
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              placeholder="Digite os códigos separados por vírgulas. Por exemplo: 4221735075026,4637243993033,8227608335903, etc..."
              className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 bg-[#F7F7F8] text-gray-700 mb-4"
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowBulkDialog(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Cancelar
              </button>
              <button
                onClick={handleBulkGenerate}
                className="px-4 py-2 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
              >
                Gerar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

