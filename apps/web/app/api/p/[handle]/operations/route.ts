import { NextRequest, NextResponse } from 'next/server';
import { getOperationsResult } from '@/lib/profiles';
import { LIMITS, enforceRateLimit } from '@/lib/rate-limit-http';

export const runtime = 'nodejs';

/**
 * GET /api/p/[handle]/operations?offset=0&limit=25
 *
 * Returns a paginated slice of operations for the given profile handle.
 * Defaults to the first 25 operations when offset/limit are omitted.
 *
 * `meta.total` is the number of operations retrieved, which is not the same as
 * the number that exist: the layer that answered reads a bounded window. When
 * `meta.truncated` is true, `meta.total` is a lower bound, `meta.cap` names the
 * limit that produced it, and a client must not present the list as complete.
 *
 * Response shape:
 *   {
 *     data: Operation[],
 *     meta: {
 *       total: number, offset: number, limit: number, hasMore: boolean,
 *       truncated: boolean, cap: number | null, source: OperationsSource
 *     }
 *   }
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ handle: string }> },
) {
  const limited = await enforceRateLimit(_req, 'profile:operations', LIMITS.read);
  if (limited) return limited;

  const { handle } = await params;

  const url = new URL(_req.url);
  const offset = Math.max(0, parseInt(url.searchParams.get('offset') ?? '0', 10) || 0);
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '25', 10) || 25));

  const { operations, truncated, cap, source } = await getOperationsResult(handle);
  const total = operations.length;
  const slice = operations.slice(offset, offset + limit);

  return NextResponse.json({
    data: slice,
    meta: {
      total,
      offset,
      limit,
      hasMore: offset + limit < total,
      truncated,
      cap,
      source,
    },
  });
}
