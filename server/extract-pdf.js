import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { readFileSync, writeFileSync } from 'fs'

const pdfPath = process.argv[2]
if (!pdfPath) { console.error('Usage: node server/extract-pdf.js <path-to-pdf>'); process.exit(1) }

const buffer = readFileSync(pdfPath)
const pdf = await getDocument({ data: buffer.buffer }).promise
let allText = []
for (let i = 1; i <= pdf.numPages; i++) {
  const page = await pdf.getPage(i)
  const content = await page.getTextContent()
  const text = content.items.map(item => item.str).join(' ')
  allText.push({ page: i, text, items: content.items.map(i => ({ str: i.str, x: i.transform[4], y: i.transform[5], font: i.fontName })) })
}

const output = { numPages: pdf.numPages, pages: allText, fullText: allText.map(p => p.text).join('\n\n') }
writeFileSync(pdfPath.replace(/\.pdf$/i, '') + '-extracted.json', JSON.stringify(output, null, 2))
console.log('Extracted', pdf.numPages, 'pages to', pdfPath.replace(/\.pdf$/i, '') + '-extracted.json')
