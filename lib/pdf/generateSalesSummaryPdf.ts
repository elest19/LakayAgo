import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface PdfRow {
  label: string
  amount: number
}

interface GenerateSalesSummaryPdfOptions {
  restaurantName: string
  startDate: string
  endDate: string
  /** One row per fixed expense. The table total is the sum of every row. */
  expenseRows: PdfRow[]
  /** One row per sales category (menu items, food bundles, services). */
  salesRows: PdfRow[]
  /** Discount subtracted from the sales breakdown to reach the gross total. */
  discountAmount?: number
  /**
   * Amount subtracted from the gross total to reach the net total. Defaults to
   * `grossTotal - netTotalAmount` so the printed formula always balances.
   */
  deductionsAmount?: number
  netTotalAmount: number
}

const PAGE_MARGIN = 40
const AMOUNT_COLUMN_WIDTH = 150

// jsPDF's built-in fonts use WinAnsiEncoding, which has no glyph for the peso sign
// (U+20B1) - it prints as a garbled character. Prefix every amount with the ASCII
// "PHP" currency code instead so amounts stay readable with the standard fonts.
const formatCurrency = (amount: number) => {
  const safeAmount = Number.isFinite(amount) ? Number(amount) : 0
  const formatted = new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(safeAmount))
  const sign = safeAmount < 0 ? '-' : ''

  return `${sign}PHP ${formatted}`
}

const formatDateLabel = (dateKey: string) => {
  const parsed = new Date(`${dateKey}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return dateKey

  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const sumAmounts = (rows: PdfRow[]) =>
  rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)

interface SummaryTableOptions {
  startY: number
  head: [string, string]
  body: string[][]
  /** Body indexes of the rows that should be emphasised (totals / gross total). */
  emphasisedRows?: number[]
  /** Renders the single "No ... found" placeholder row in muted grey. */
  placeholderRow?: boolean
}

// Every table shares the same grid, head fill and column widths so the Fixed Expenses
// and Gross Sales tables line up: the two column widths always fill the printable
// width exactly (page width minus both margins), which keeps long amounts inside the
// right-aligned Amount column instead of spilling over the page edge.
const renderSummaryTable = (pdf: jsPDF, pageWidth: number, options: SummaryTableOptions) => {
  autoTable(pdf, {
    startY: options.startY,
    head: [options.head],
    body: options.body,
    theme: 'grid',
    styles: {
      fontSize: 9,
      cellPadding: 6,
      valign: 'middle',
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: 255,
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: pageWidth - PAGE_MARGIN * 2 - AMOUNT_COLUMN_WIDTH },
      1: { cellWidth: AMOUNT_COLUMN_WIDTH, halign: 'right' },
    },
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
    didParseCell: (data) => {
      if (data.section !== 'body') return

      if (options.placeholderRow) {
        data.cell.styles.textColor = [100, 116, 139]
        return
      }

      if (options.emphasisedRows?.includes(data.row.index)) {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fillColor = [241, 245, 249]
      }
    },
  })
}

export function generateSalesSummaryPdf({
  restaurantName,
  startDate,
  endDate,
  expenseRows,
  salesRows,
  discountAmount = 0,
  deductionsAmount,
  netTotalAmount,
}: GenerateSalesSummaryPdfOptions) {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const contentWidth = pageWidth - PAGE_MARGIN * 2

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(16)
  pdf.text('Monthly Report', PAGE_MARGIN, 52)

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.text(`${restaurantName}`, PAGE_MARGIN, 72)
  pdf.text(`${formatDateLabel(startDate)} - ${formatDateLabel(endDate)}`, PAGE_MARGIN, 86)

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(12)
  pdf.text('GROSS SALES & EXPENSES', PAGE_MARGIN, 118)

  // --- Fixed Expenses: every filtered expense row plus a bold total row. -----
  const expenseTotal = sumAmounts(expenseRows)
  const expenseBody = expenseRows.map((row) => [row.label, formatCurrency(row.amount)])
  const hasExpenses = expenseBody.length > 0

  if (hasExpenses) {
    expenseBody.push(['Total Amount', formatCurrency(expenseTotal)])
  } else {
    expenseBody.push(['No expenses found', formatCurrency(0)])
  }

  renderSummaryTable(pdf, pageWidth, {
    startY: 132,
    head: ['Fixed Expenses', 'Amount'],
    body: expenseBody,
    emphasisedRows: hasExpenses ? [expenseBody.length - 1] : [],
    placeholderRow: !hasExpenses,
  })

  // --- Gross Sales: category rows, total, discount, then the gross total. ----
  const salesBreakdownTotal = sumAmounts(salesRows)
  const safeDiscount = Number.isFinite(discountAmount) ? Number(discountAmount) : 0
  const grossTotalAmount = salesBreakdownTotal - safeDiscount
  const salesBody = salesRows.map((row) => [row.label, formatCurrency(row.amount)])
  const hasSales = salesBody.length > 0

  if (hasSales) {
    salesBody.push(['Total Amount', formatCurrency(salesBreakdownTotal)])
    salesBody.push(['Less Discount', formatCurrency(-safeDiscount)])
    salesBody.push(['Gross Total Amount', formatCurrency(grossTotalAmount)])
  } else {
    salesBody.push(['No sales found', formatCurrency(0)])
  }

  renderSummaryTable(pdf, pageWidth, {
    startY: (pdf as any).lastAutoTable.finalY + 18,
    head: ['Gross Sales', 'Amount'],
    body: salesBody,
    // "Total Amount" and "Gross Total Amount" are bold; "Less Discount" stays plain.
    emphasisedRows: hasSales ? [salesBody.length - 3, salesBody.length - 1] : [],
    placeholderRow: !hasSales,
  })

  // --- Net Total: gross total minus deductions, shown as its own formula. ----
  // The net total is not just "gross total - fixed expenses": service penalties, asset
  // penalties and the item/bundle ingredient expenses come off it as well, while some
  // fixed expenses (rent, salaries, ...) never do. The deduction therefore uses the
  // amount that actually reconciles the two figures - `deductionsAmount` when the page
  // supplies it, otherwise the residual - so the printed formula always adds up.
  const netDeductions = Number.isFinite(deductionsAmount)
    ? Number(deductionsAmount)
    : grossTotalAmount - netTotalAmount

  const finalY = (pdf as any).lastAutoTable.finalY + 24
  const netTotalLine = `Net Total Amount (${formatCurrency(grossTotalAmount)} - ${formatCurrency(netDeductions)}) = ${formatCurrency(netTotalAmount)}`

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.setTextColor(netTotalAmount < 0 ? 220 : 22, netTotalAmount < 0 ? 38 : 163, netTotalAmount < 0 ? 38 : 74)

  // Shrink the line once if a very large amount would overrun the right margin.
  if (pdf.getTextWidth(netTotalLine) > contentWidth) {
    pdf.setFontSize(8)
  }

  pdf.text(netTotalLine, pageWidth - PAGE_MARGIN, finalY, { align: 'right' })
  pdf.setTextColor(0, 0, 0)

  const safeRestaurantName = restaurantName.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'restaurant'
  const filename = `monthly-report-${safeRestaurantName}-${startDate}-to-${endDate}.pdf`
  pdf.save(filename)
}

