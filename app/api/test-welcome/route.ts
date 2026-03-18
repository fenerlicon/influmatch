// This endpoint has been disabled for security reasons.
// It was a development/test tool that had no authentication guards.
// If you need to send welcome messages, use the admin panel instead.

import { NextResponse } from 'next/server'

export async function GET() {
    return NextResponse.json(
        { error: 'This endpoint is disabled.' },
        { status: 410 } // 410 Gone
    )
}
