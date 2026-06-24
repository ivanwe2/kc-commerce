// TODO: Replace with e-commerce seed in Phase 2
import { seed } from '@/endpoints/seed'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  // @ts-expect-error - endpoint handler signature mismatch, will be fixed in Phase 2
  const res = await seed.handler(req as any)
  return res
}
