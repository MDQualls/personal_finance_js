import { NextResponse } from 'next/server'

export function apiSuccess<T>(data: T, meta?: Record<string, unknown>) {
  return NextResponse.json({ data, ...(meta ? { meta } : {}) }, { status: 200 })
}

export function apiError(message: string | Record<string, unknown>, status: number) {
  return NextResponse.json({ error: message }, { status })
}
