import { createClient } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'

export type RealtimePayload = {
  eventType?: 'INSERT' | 'UPDATE' | 'DELETE' | string
  schema?: string
  table?: string
  new?: Record<string, any> | null
  old?: Record<string, any> | null
}

let supabaseClient: ReturnType<typeof createClient> | null = null

export function getSupabaseClient() {
  if (supabaseClient) return supabaseClient

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[realtime] Missing SUPABASE client environment variables')
    return null
  }

  supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: {
      headers: {
        'X-Client-Info': 'lakay-ago-realtime',
      },
    },
  })

  return supabaseClient
}

export function isRealtimeRowNewer(
  currentRow: Record<string, any> | null | undefined,
  incomingRow: Record<string, any> | null | undefined,
): boolean {
  const currentTs = currentRow?.updated_at ?? currentRow?.created_at ?? currentRow?.updatedAt ?? currentRow?.createdAt ?? null
  const incomingTs = incomingRow?.updated_at ?? incomingRow?.created_at ?? incomingRow?.updatedAt ?? incomingRow?.createdAt ?? null

  if (!incomingTs) return true
  if (!currentTs) return true

  return new Date(incomingTs).getTime() >= new Date(currentTs).getTime()
}

export function useRealtimeEntity(
  table: string,
  opts: {
    restaurant?: string | null
    onChange: (payload: RealtimePayload) => void
  },
) {
  const { restaurant, onChange } = opts

  useEffect(() => {
    if (!table) return

    const client = getSupabaseClient()
    if (!client) return

    const normalizedRestaurant = restaurant && restaurant !== 'Both' ? restaurant.replace(/ /g, '%20') : undefined
    const channel = client.channel(`${table}-${restaurant ?? 'all'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: normalizedRestaurant ? `restaurant=eq.${normalizedRestaurant}` : undefined,
        },
        payload => {
          onChange(payload as RealtimePayload)
        },
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn(`[realtime:${table}] channel error for ${restaurant ?? 'all'}`)
        }
      })

    return () => {
      client.removeChannel(channel)
    }
  }, [table, restaurant, onChange])
}

export function useRealtimeConnectionStatus(table = 'employees', restaurant?: string | null): 'connecting' | 'connected' | 'closed' | 'channel_error' {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'closed' | 'channel_error'>('connecting')

  useEffect(() => {
    const client = getSupabaseClient()
    if (!client) {
      setStatus('closed')
      return
    }

    const normalizedRestaurant = restaurant && restaurant !== 'Both' ? restaurant.replace(/ /g, '%20') : undefined
    const channel = client.channel(`${table}-status-${restaurant ?? 'all'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: normalizedRestaurant ? `restaurant=eq.${normalizedRestaurant}` : undefined,
        },
        () => {
          setStatus('connected')
        },
      )
      .subscribe((nextStatus) => {
        if (nextStatus === 'SUBSCRIBED') setStatus('connected')
        else if (nextStatus === 'TIMED_OUT' || nextStatus === 'CLOSED') setStatus('closed')
        else if (nextStatus === 'CHANNEL_ERROR') setStatus('channel_error')
        else setStatus('connecting')
      })

    return () => {
      client.removeChannel(channel)
    }
  }, [restaurant, table])

  return status
}
