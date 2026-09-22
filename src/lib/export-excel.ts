/**
 * Utilidad compartida de exportación a Excel.
 * Uses ExcelJS (dynamic import) so the ~2 MB bundle only loads on demand.
 *
 * Usage:
 *   await exportExcel("Mi Reporte", [{
 *     name: "Hoja 1",
 *     columns: [{ header: "Nombre", key: "nombre" }, { header: "Total", key: "total", numFmt: "#,##0.0" }],
 *     rows: [{ nombre: "Juan", total: 3.5 }],
 *     totalsRow: { nombre: "TOTAL", total: 3.5 }
 *   }])
 */

export type ExcelColumn = {
  header: string
  key: string
  width?: number   // optional override; auto-calculated from content if omitted
  numFmt?: string  // e.g. '#,##0.0' for decimals, '#,##0' for integers, 'DD/MM/YYYY' for dates
}

export type ExcelSheet = {
  name: string
  columns: ExcelColumn[]
  rows: Record<string, any>[]
  totalsRow?: Record<string, any>
  /** Color de fondo ARGB (ej. 'FFFFF9C4') para filas que lo necesiten, ej. destacar un estado. */
  rowFill?: (row: Record<string, any>) => string | undefined
  /** Claves de columnas numéricas donde aplicar barras de datos nativas de Excel (efecto tipo gráfico). */
  dataBarColumns?: string[]
  /** Claves de columnas numéricas donde aplicar escala de color (verde-amarillo-rojo) nativa de Excel. */
  colorScaleColumns?: string[]
  /**
   * Agrupa las filas por el valor de esta columna (deben venir pre-ordenadas por esa clave),
   * insertando una fila de subtotal (fórmula SUBTOTAL) al cierre de cada grupo.
   * Al usar esto la hoja se arma como rango con formato manual en vez de Tabla de Excel
   * (sin botones de filtro de tabla, pero con encabezado congelado igual).
   */
  groupBy?: {
    key: string
    /** columnas numéricas donde calcular el subtotal (suma) de cada grupo */
    subtotalKeys: string[]
    /** etiqueta de la fila de subtotal; por defecto `${valor del grupo} — Subtotal` */
    label?: (groupValue: string) => string
  }
}

/** Bloque de imagen (captura PNG de un gráfico ya renderizado) para una hoja de imágenes. */
export type ExcelImageBlock = {
  title: string
  /** Data URL completa, ej. "data:image/png;base64,...." */
  dataUrl: string
  widthPx: number
  heightPx: number
}

/** Hoja compuesta solo por imágenes (gráficos capturados desde pantalla), sin tabla. */
export type ExcelImageSheet = {
  name: string
  type: 'images'
  images: ExcelImageBlock[]
}

const BRAND    = 'FF145F87' // azul de marca Syntara (nombre histórico, ver AGENTS/CLAUDE.md)
const DARK     = 'FF104C6C'
const WHITE    = 'FFFFFFFF'
const ALT_ROW  = 'FFEEF3F6'
const TOTAL_BG = 'FFD3E1E8'
const BORDER   = 'FFE2E8F0'

function isImageSheet(sheet: ExcelSheet | ExcelImageSheet): sheet is ExcelImageSheet {
  return (sheet as ExcelImageSheet).type === 'images'
}

function colLetter(n: number): string {
  let s = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    s = String.fromCharCode(65 + rem) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

/** Excel prohíbe : \ / ? * [ ] en nombres de hoja y limita a 31 caracteres. */
export function sanitizeSheetName(name: string): string {
  return name.replace(/[:\\/?*[\]]/g, '-').slice(0, 31)
}

function autoWidth(col: ExcelColumn, rows: Record<string, any>[]): number {
  const contentMax = rows.reduce((max, row) => Math.max(max, String(row[col.key] ?? '').length), col.header.length)
  return col.width ?? Math.min(Math.max(contentMax + 4, 10), 60)
}

const THIN_BORDER = { style: 'thin' as const, color: { argb: BORDER } }
const CELL_BORDER = { top: THIN_BORDER, left: THIN_BORDER, bottom: THIN_BORDER, right: THIN_BORDER }

function buildGroupedSheet(wb: import('exceljs').Workbook, sheet: ExcelSheet) {
  const ws = wb.addWorksheet(sanitizeSheetName(sheet.name), {
    views: [{ state: 'frozen', ySplit: 1 }],
    pageSetup: { fitToPage: true, fitToWidth: 1, orientation: 'landscape' }
  })

  ws.columns = sheet.columns.map(col => ({ key: col.key, width: autoWidth(col, sheet.rows) }))

  const headerRow = ws.getRow(1)
  headerRow.height = 24
  sheet.columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1)
    cell.value = col.header
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: WHITE } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    cell.border = CELL_BORDER
  })

  const { key: groupKey, subtotalKeys, label } = sheet.groupBy!
  let r = 2
  let currentGroup: string | undefined
  let groupStartRow = 2

  const writeSubtotalRow = (groupValue: string, startRow: number, endRow: number) => {
    const row = ws.getRow(r)
    row.height = 20
    sheet.columns.forEach((col, i) => {
      const cell = row.getCell(i + 1)
      if (i === 0) {
        cell.value = label ? label(groupValue) : `${groupValue} — Subtotal`
      } else if (subtotalKeys.includes(col.key)) {
        const letter = colLetter(i + 1)
        cell.value = { formula: `SUBTOTAL(9,${letter}${startRow}:${letter}${endRow})` } as any
        if (col.numFmt) cell.numFmt = col.numFmt
      }
      cell.font = { name: 'Calibri', size: 10, bold: true }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ALT_ROW } }
      cell.border = CELL_BORDER
    })
    r += 1
  }

  sheet.rows.forEach(rowData => {
    const groupValue = String(rowData[groupKey] ?? '')
    if (currentGroup !== undefined && groupValue !== currentGroup) {
      writeSubtotalRow(currentGroup, groupStartRow, r - 1)
      groupStartRow = r
    }
    currentGroup = groupValue

    const row = ws.getRow(r)
    row.height = 18
    const fillColor = sheet.rowFill?.(rowData)
    sheet.columns.forEach((col, i) => {
      const cell = row.getCell(i + 1)
      const val = rowData[col.key]
      cell.value = val === undefined || val === null ? '' : val
      if (col.numFmt) cell.numFmt = col.numFmt
      cell.font = { name: 'Calibri', size: 10 }
      cell.alignment = { vertical: 'middle' }
      if (fillColor) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } }
      cell.border = CELL_BORDER
    })
    r += 1
  })
  if (currentGroup !== undefined) {
    writeSubtotalRow(currentGroup, groupStartRow, r - 1)
  }

  if (sheet.totalsRow) {
    const row = ws.getRow(r)
    row.height = 22
    sheet.columns.forEach((col, i) => {
      const cell = row.getCell(i + 1)
      const val = sheet.totalsRow![col.key]
      if (subtotalKeys.includes(col.key)) {
        const letter = colLetter(i + 1)
        cell.value = { formula: `SUBTOTAL(9,${letter}2:${letter}${r - 1})` } as any
        if (col.numFmt) cell.numFmt = col.numFmt
      } else if (typeof val === 'string' && val.trim() !== '') {
        cell.value = val
      }
      cell.font = { name: 'Calibri', size: 10, bold: true }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_BG } }
      cell.border = CELL_BORDER
    })
  }

  if (sheet.dataBarColumns?.length) {
    sheet.columns.forEach((col, colIdx) => {
      if (!sheet.dataBarColumns!.includes(col.key)) return
      const letter = colLetter(colIdx + 1)
      ws.addConditionalFormatting({
        ref: `${letter}2:${letter}${r - 1}`,
        rules: [{ type: 'dataBar', cfvo: [{ type: 'min' }, { type: 'max' }], color: { argb: BRAND }, gradient: true } as any]
      })
    })
  }
  if (sheet.colorScaleColumns?.length) {
    sheet.columns.forEach((col, colIdx) => {
      if (!sheet.colorScaleColumns!.includes(col.key)) return
      const letter = colLetter(colIdx + 1)
      ws.addConditionalFormatting({
        ref: `${letter}2:${letter}${r - 1}`,
        rules: [{
          type: 'colorScale',
          cfvo: [{ type: 'min' }, { type: 'percentile', value: 50 }, { type: 'max' }],
          color: [{ argb: 'FFC6EFCE' }, { argb: 'FFFFEB9C' }, { argb: 'FFFFC7CE' }],
        } as any]
      })
    })
  }
}

export async function exportExcel(filename: string, sheets: (ExcelSheet | ExcelImageSheet)[]): Promise<void> {
  const ExcelJS = (await import('exceljs')).default

  const wb = new ExcelJS.Workbook()
  wb.creator = 'Condominio Villa Tepual'
  wb.created = new Date()

  for (const sheet of sheets) {
    if (!isImageSheet(sheet) && sheet.groupBy) {
      buildGroupedSheet(wb, sheet)
      continue
    }

    if (isImageSheet(sheet)) {
      const ws = wb.addWorksheet(sheet.name)
      let rowCursor = 1
      for (const block of sheet.images) {
        const titleCell = ws.getCell(`A${rowCursor}`)
        titleCell.value = block.title
        titleCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: DARK } }
        rowCursor += 1

        const imageId = wb.addImage({ base64: block.dataUrl, extension: 'png' })
        ws.addImage(imageId, {
          tl: { col: 0, row: rowCursor - 1 },
          ext: { width: block.widthPx, height: block.heightPx }
        })
        rowCursor += Math.ceil(block.heightPx / 20) + 2
      }
      continue
    }

    const ws = wb.addWorksheet(sheet.name, {
      views: [{ state: 'frozen', ySplit: 1 }],
      pageSetup: { fitToPage: true, fitToWidth: 1, orientation: 'landscape' }
    })

    // Auto-calculate column widths from content
    ws.columns = sheet.columns.map(col => {
      const contentMax = sheet.rows.reduce((max, row) => {
        return Math.max(max, String(row[col.key] ?? '').length)
      }, col.header.length)
      return {
        header: col.header,
        key: col.key,
        width: col.width ?? Math.min(Math.max(contentMax + 4, 10), 60)
      }
    })

    const tableRows = sheet.rows.map(row => 
      sheet.columns.map(col => {
        const val = row[col.key]
        return val === undefined || val === null ? '' : val
      })
    )

    const tableName = `Tabla_${sheet.name.replace(/[^a-zA-Z0-9]/g, '_')}`
    
    // We add the table to ExcelJS (this creates headers and rows with TableStyleMedium9)
    ws.addTable({
      name: tableName,
      ref: 'A1',
      headerRow: true,
      totalsRow: !!sheet.totalsRow,
      style: {
        theme: 'TableStyleMedium9',
        showRowStripes: true,
      },
      columns: sheet.columns.map((col, colIdx) => {
        const totalsVal = sheet.totalsRow?.[col.key]

        let totalsRowFunction: 'none' | 'sum' | 'count' | 'average' | 'custom' | undefined = undefined
        let totalsRowLabel: string | undefined = undefined

        // Cada columna decide su propia celda de totales según lo que el caller
        // puso en totalsRow[col.key]: texto → etiqueta (ej. "TOTAL"), número → Excel
        // calcula la suma real vía SUBTOTAL sobre los datos de la tabla (más
        // confiable que escribir a mano el número que calculamos en JS).
        if (typeof totalsVal === 'string' && totalsVal.trim() !== '') {
          totalsRowLabel = totalsVal
        } else if (typeof totalsVal === 'number') {
          totalsRowFunction = 'sum'
        } else if (!!sheet.totalsRow && colIdx === 0 && (totalsVal === undefined || totalsVal === null || totalsVal === '')) {
          // Nadie especificó nada para la primera columna: al menos deja "TOTAL"
          // para que la fila sea reconocible.
          totalsRowLabel = 'TOTAL'
        }

        return {
          name: col.header,
          filterButton: true,
          totalsRowFunction,
          totalsRowLabel
        }
      }),
      rows: tableRows
    })

    // Format all cells in the sheet for fonts, alignments, and number formats
    const totalRowsCount = sheet.rows.length + 1 + (sheet.totalsRow ? 1 : 0)
    for (let r = 1; r <= totalRowsCount; r++) {
      const row = ws.getRow(r)
      // Heights: header = 24, totals = 22, data = 18
      row.height = r === 1 ? 24 : r === totalRowsCount && sheet.totalsRow ? 22 : 18

      // r=1 es header; filas de datos van de r=2 a r=sheet.rows.length+1
      const dataRowIdx = r - 2
      const isDataRow = dataRowIdx >= 0 && dataRowIdx < sheet.rows.length
      const fillColor = isDataRow && sheet.rowFill ? sheet.rowFill(sheet.rows[dataRowIdx]) : undefined

      row.eachCell({ includeEmpty: true }, (cell, colNum) => {
        const col = sheet.columns[colNum - 1]

        // Font (Bold for headers and totals row)
        cell.font = {
          name: 'Calibri',
          size: 10,
          bold: r === 1 || (r === totalRowsCount && !!sheet.totalsRow),
          color: r === 1 ? { argb: 'FFFFFFFF' } : undefined
        }

        // Alignment
        if (r === 1) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' }
        } else {
          cell.alignment = { vertical: 'middle' }
        }

        // Number formatting
        if (col?.numFmt) {
          cell.numFmt = col.numFmt
        }

        // Color de fondo por fila (ej. destacar pendientes con licencia/vacaciones)
        if (fillColor) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } }
        }
      })
    }

    // Barras de datos nativas de Excel (efecto tipo gráfico dentro de la tabla)
    if (sheet.dataBarColumns?.length && sheet.rows.length > 0) {
      sheet.columns.forEach((col, colIdx) => {
        if (!sheet.dataBarColumns!.includes(col.key)) return
        const letter = colLetter(colIdx + 1)
        const lastRow = sheet.rows.length + 1
        ws.addConditionalFormatting({
          ref: `${letter}2:${letter}${lastRow}`,
          rules: [{
            type: 'dataBar',
            cfvo: [{ type: 'min' }, { type: 'max' }],
            color: { argb: BRAND },
            gradient: true,
          } as any]
        })
      })
    }

    // Escala de color (verde→amarillo→rojo) nativa de Excel, ej. para destacar riesgo/pendientes
    if (sheet.colorScaleColumns?.length && sheet.rows.length > 0) {
      sheet.columns.forEach((col, colIdx) => {
        if (!sheet.colorScaleColumns!.includes(col.key)) return
        const letter = colLetter(colIdx + 1)
        const lastRow = sheet.rows.length + 1
        ws.addConditionalFormatting({
          ref: `${letter}2:${letter}${lastRow}`,
          rules: [{
            type: 'colorScale',
            cfvo: [{ type: 'min' }, { type: 'percentile', value: 50 }, { type: 'max' }],
            color: [{ argb: 'FFC6EFCE' }, { argb: 'FFFFEB9C' }, { argb: 'FFFFC7CE' }],
          } as any]
        })
      })
    }
  }

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
