import { NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import fs from 'fs'
import path from 'path'
import getSessionFromRequest from '../../../../../lib/session'
import { query } from '../../../../../lib/db'

export async function GET(req: Request, ctx: any) {
  const session = getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const params = await ctx.params
    const payslipId = Number(params.payslipId)
    if (!Number.isFinite(payslipId)) return NextResponse.json({ error: 'Invalid payslip id' }, { status: 400 })

    const res = await query('select * from payslips where payslip_id = $1 limit 1', [payslipId])
    const p = res.rows[0]
    if (!p) return NextResponse.json({ error: 'Payslip not found' }, { status: 404 })
    if (session.role !== 'SuperAdmin' && p.restaurant !== session.restaurant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // fetch report period for date range
    const periodRes = await query('select period_start, period_end from report_periods where report_period_id = $1 limit 1', [p.report_period_id])
    const periodRow = periodRes.rows[0]
    const periodLabel = periodRow ? `${new Date(periodRow.period_start).toLocaleDateString()} - ${new Date(periodRow.period_end).toLocaleDateString()}` : ''

    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([595.28, 841.89]) // A4
    const { width, height } = page.getSize()
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    const margin = 40
    const contentWidth = width - margin * 2

    // helper formatters
    // Use ASCII-safe currency label because embedded WinAnsi fonts cannot encode the peso sign
    const fmt = (n: number) => {
      const amount = Number(n || 0)
      const formatted = new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
      return `PHP ${formatted}`
    }
    

    // HEADER
    const headerY = height - margin
    // estimate header occupied height (adjusted if logo present)
    let headerOccupiedHeight = 36
    // logo + restaurant name
    try {
      const logoFilename = (p.restaurant && p.restaurant.toLowerCase().includes('aroo')) ? 'Aroo_Logo.jpg' : 'logo.jpg'
      const logoPath = path.join(process.cwd(), 'public', logoFilename)
      if (fs.existsSync(logoPath)) {
        const logoBytes = fs.readFileSync(logoPath)
        const img = await pdfDoc.embedJpg(logoBytes)
        const origWidth = (img as any).width || (img as any).size?.width || 48
        const origHeight = (img as any).height || (img as any).size?.height || 48
        const targetHeight = 48
        const scale = targetHeight / origHeight
        const drawWidth = origWidth * scale
        const drawHeight = targetHeight
        const logoX = margin
        const logoY = headerY - 36
        page.drawImage(img, { x: logoX, y: logoY, width: drawWidth, height: drawHeight })
        headerOccupiedHeight = Math.max(headerOccupiedHeight, drawHeight + 12)
        // restaurant name to the right of logo
        const nameX = logoX + drawWidth + 8
        page.drawText(p.restaurant || '', { x: nameX, y: headerY - 6, size: 16, font: fontBold })
        page.drawText('Attendance & Payroll', { x: nameX, y: headerY - 24, size: 9, font })
      } else {
        page.drawText(p.restaurant || '', { x: margin, y: headerY, size: 16, font: fontBold })
        page.drawText('Attendance & Payroll', { x: margin, y: headerY - 18, size: 9, font })
      }
    } catch (err) {
      // fallback to text-only header
      page.drawText(p.restaurant || '', { x: margin, y: headerY, size: 16, font: fontBold })
      page.drawText('Attendance & Payroll', { x: margin, y: headerY - 18, size: 9, font })
    }

    // EMPLOYEE SUMMARY (position below header)
    const summaryTop = headerY - headerOccupiedHeight 
    const boxHeight = 80
    const boxGap = 12
    const leftBoxX = margin
    const rightBoxX = margin + (contentWidth / 2) + boxGap
    const boxWidth = (contentWidth / 2) - boxGap

    // left box border
    page.drawRectangle({ x: leftBoxX, y: summaryTop - boxHeight, width: boxWidth, height: boxHeight, borderColor: rgb(0.85,0.85,0.85), borderWidth: 1 })
    let sy = summaryTop - 15
    page.drawText(`Employee Name: ${p.employee_name || ''}`, { x: leftBoxX + 8, y: sy, size: 10, font })
    sy -= 14
    page.drawText(`Employee ID: ${String(p.employee_id ?? '')}`, { x: leftBoxX + 8, y: sy, size: 10, font })
    sy -= 14
    page.drawText(`Pay Period: ${periodLabel || ''}`, { x: leftBoxX + 8, y: sy, size: 10, font })
    sy -= 14

    // right highlighted box (green)
    const green = rgb(0.87, 0.96, 0.88)
    page.drawRectangle({ x: rightBoxX, y: summaryTop - boxHeight, width: boxWidth, height: boxHeight, color: green, borderColor: rgb(0.7,0.85,0.7), borderWidth: 1 })
    const netTop = summaryTop - 35
    const netText = fmt(Number(p.net_pay || 0))
    const netTextWidth = fontBold.widthOfTextAtSize(netText, 24)
    page.drawText(netText, { x: rightBoxX + boxWidth - netTextWidth - 12, y: netTop, size: 24, font: fontBold, color: rgb(0,0.45,0) })
    page.drawText('Total Net Pay', { x: rightBoxX + boxWidth - 80, y: netTop - 18, size: 9, font })

    // EARNINGS / DEDUCTIONS columns
    const tableTop = summaryTop - boxHeight - 30
    const colGap = 20
    const colWidth = (contentWidth - colGap) / 2
    const leftColX = margin
    const rightColX = margin + colWidth + colGap
    let ty = tableTop

    page.drawText('EARNINGS', { x: leftColX, y: ty, size: 11, font: fontBold })
    page.drawText('DEDUCTIONS', { x: rightColX, y: ty, size: 11, font: fontBold })
    ty -= 16

    const earnings: [string, number][] = [
      ['Base Pay', Number(p.base_pay || 0)],
      ['Overtime Pay', Number(p.overtime_pay || 0)],
      ['Halfday Pay', Number(p.halfday_pay || 0)],
      ['Holiday Pay', Number(p.holiday_pay || 0)],
    ]
    const deductions: [string, number][] = [
      ['Undertime Deductions', Number(p.undertime_deduction || 0)],
      ['Late Deductions', Number((p.late_deduction ?? p.sum_late_min) || 0)],
      ['Cash Advance', Number(p.cash_advance_deduction || 0)],
      ['SSS', Number(p.sss_deduction || 0)],
      ['PhilHealth', Number(p.philhealth_deduction || 0)],
      ['Pag-IBIG', Number(p.pagibig_deduction || 0)],
    ]

    const rowHeight = 14
    for (let i = 0; i < Math.max(earnings.length, deductions.length); i++) {
      const e = earnings[i]
      const d = deductions[i]
      if (e) {
        page.drawText(e[0], { x: leftColX, y: ty, size: 10, font })
        const amt = fmt(e[1])
        const w = font.widthOfTextAtSize(amt, 10)
        page.drawText(amt, { x: leftColX + colWidth - w, y: ty, size: 10, font })
      }
      if (d) {
        page.drawText(d[0], { x: rightColX, y: ty, size: 10, font })
        const amt2 = fmt(d[1])
        const w2 = font.widthOfTextAtSize(amt2, 10)
        page.drawText(amt2, { x: rightColX + colWidth - w2, y: ty, size: 10, font })
      }
      ty -= rowHeight
    }

    // divider row (thin rectangle)
    const dividerY = ty - 6
    page.drawRectangle({ x: margin, y: dividerY - 0.5, width: width - margin * 2, height: 1, color: rgb(0.85,0.85,0.85) })
    // gross earnings left
    const grossLabelY = dividerY - 20
    page.drawText('Gross Earnings', { x: leftColX, y: grossLabelY, size: 11, font: fontBold })
    const grossAmt = fmt(Number(p.gross_pay || 0))
    const gw = fontBold.widthOfTextAtSize(grossAmt, 11)
    page.drawText(grossAmt, { x: leftColX + colWidth - gw, y: grossLabelY, size: 11, font: fontBold })
    // total deductions right
    page.drawText('Total Deductions', { x: rightColX, y: grossLabelY, size: 11, font: fontBold })
    const totalDed = fmt(Number(p.total_deduction || 0))
    const tw = fontBold.widthOfTextAtSize(totalDed, 11)
    page.drawText(totalDed, { x: rightColX + colWidth - tw, y: grossLabelY, size: 11, font: fontBold })

    // TOTAL NET PAYABLE BAR
    const barY = grossLabelY - 50
    const barHeight = 36
    const lightGreen = rgb(0.88,0.96,0.88)
    page.drawRectangle({ x: margin, y: barY, width: contentWidth, height: barHeight, color: lightGreen })
    page.drawText('TOTAL NET PAYABLE', { x: margin + 8, y: barY + 18, size: 10, font: fontBold })
    page.drawText('Gross Earnings - Total Deductions', { x: margin + 8, y: barY + 6, size: 8, font })
    const netPayText = fmt(Number(p.net_pay || 0))
    const netW = fontBold.widthOfTextAtSize(netPayText, 14)
    page.drawText(netPayText, { x: margin + contentWidth - netW - 12, y: barY + 10, size: 14, font: fontBold, color: rgb(0,0.45,0) })

    // FOOTER
    page.drawText(`Copyright © 2023 ${p.restaurant || "Company Name"}. All rights reserved.`, { x: width / 2 - 120, y: 30, size: 9, font, color: rgb(0.45,0.45,0.45) })

    const pdfBytes = await pdfDoc.save()
    const fileName = `payslip-${(p.employee_name || 'employee').replace(/\s+/g, '_')}-${p.report_period_id}.pdf`
    return new Response(Buffer.from(pdfBytes), { status: 200, headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${fileName}"` } })
  } catch (err) {
    console.error('payslip download error', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
