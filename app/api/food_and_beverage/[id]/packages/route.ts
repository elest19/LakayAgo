import { NextResponse } from 'next/server'
import { query } from '../../../../../lib/db'
import getSessionFromRequest from '../../../../../lib/session'

export async function GET(req: Request, { params }: { params: any }) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const itemId = Number(id)
    if (!Number.isFinite(itemId) || itemId <= 0) {
      return NextResponse.json({ error: 'Invalid food item id' }, { status: 400 })
    }

    const paramsList: any[] = [itemId]
    let restaurantClause = ''
    if (session.role !== 'SuperAdmin') {
      restaurantClause = `and (fp.restaurant = $2 or fp.restaurant = 'Both')`
      paramsList.push(session.restaurant)
    }

    const result = await query(
      `
        select
          fpi.food_package_item_id,
          fpi.food_and_beverage_id,
          fpi.quantity,
          fp.food_package_id,
          fp.name as package_name,
          fp.price,
          fp.restaurant,
          fp.is_archived
        from food_package_items fpi
        inner join food_packages fp on fp.food_package_id = fpi.food_package_id
        where fpi.food_and_beverage_id = $1
          and fp.is_archived = false
          ${restaurantClause}
        order by fp.name asc
      `,
      paramsList
    )

    return NextResponse.json({ packages: result.rows, count: result.rows.length })
  } catch (err) {
    console.error('GET /api/food_and_beverage/[id]/packages failed', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
