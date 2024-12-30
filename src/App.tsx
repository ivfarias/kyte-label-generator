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
      return new Promise<string>((resolve) => {
        const canvas = document.createElement('canvas');
        JsBarcode(canvas, code, { format: barcodeFormat });
        resolve(canvas.toDataURL('image/png'));
      });
    }
  };

  const handleGenerate = async () => {
    const base64 = await generateBarcode(input, barcodeType);
    setGeneratedCodes([base64]);
  }

  const handleBulkGenerate = async () => {
    const codes = bulkInput.split(',').map(code => code.trim())
    const generatedBarcodes = await Promise.all(
      codes.map(async (code) => {
        const type = detectBarcodeType(code)
        return generateBarcode(code, type)
      })
    )
    setGeneratedCodes(generatedBarcodes)
    setShowBulkDialog(false)
  }

  const downloadBarcode = (index: number) => {
    const link = document.createElement('a')
    link.href = generatedCodes[index]
    link.download = `barcode-${Date.now()}.png`
    link.click()
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
        <p className="text-gray-500 text-sm mb-6">Preencha as informações abaixo para criar uma etique. Caso deseje criar várias, aperte o botão "Gerar vários""</p>
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
            <label htmlFor="barcodeType" className="block text-base font-medium text-gray-700 mb-2 justify-self-start">Confira o tipo de código detectado ou escolha uma opção</label>
            <input
              id="barcodeType"
              type="text"
              value={barcodeType}
              readOnly
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 text-gray-700"
            />
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
                  Download
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium mb-2">Gerador de etiquetas em massa</h3>
            <p className="text-gray-600 mb-4">Escreva ou cole seus códigos de barra separados por vírgula.</p>
            <textarea
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              placeholder="4221735075026,4637243993033,8227608335903,4180168059921, etc..."
              rows={5}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 bg-[#F7F7F8] mb-4"
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowBulkDialog(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Cancelar
              </button>
              <button
                onClick={handleBulkGenerate}
                className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
              >
                Gerar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

