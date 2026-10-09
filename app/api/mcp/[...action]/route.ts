import { NextResponse } from 'next/server';
import {
  assertSafeData,
  callTool,
  connectUser,
  connectionStatus,
  disconnectUser,
  listTools,
  UncertainWriteError,
} from '@/lib/mcp';
import { actionHistory, executeAction, previewAction } from '@/lib/actions';
import { assertSameOrigin, userId } from '@/lib/user';

export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'no-store' };
async function route(
  request: Request,
  method: 'GET' | 'POST',
  context: { params: Promise<{ action: string[] }> },
) {
  try {
    assertSameOrigin(request);
    const user = userId(request);
    const { action } = await context.params;
    const key = action.join('/');
    if (method === 'GET') {
      if (key === 'status') return NextResponse.json(connectionStatus(user), { headers });
      if (key === 'tools') return NextResponse.json({ tools: await listTools(user) }, { headers });
      if (key === 'actions')
        return NextResponse.json({ actions: actionHistory(user) }, { headers });
    } else {
      if (Number(request.headers.get('content-length') ?? 0) > 100000)
        return NextResponse.json({ error: '请求内容过长' }, { status: 413, headers });
      const content = await request.text();
      if (content.length > 100000) throw new Error('请求内容过长');
      const body = JSON.parse(content);
      if (!body || typeof body !== 'object' || Array.isArray(body))
        throw new Error('请求必须是对象');
      assertSafeData(body);
      if (key === 'connect')
        return NextResponse.json(await connectUser(user, body.token), { headers });
      if (key === 'disconnect') return NextResponse.json(await disconnectUser(user), { headers });
      if (key === 'read') {
        if (typeof body.name !== 'string') throw new Error('请选择查询工具');
        return NextResponse.json(
          { result: await callTool(user, body.name, body.args ?? {}) },
          { headers },
        );
      }
      if (key === 'preview') {
        if (typeof body.name !== 'string') throw new Error('请选择操作');
        return NextResponse.json(await previewAction(user, body.name, body.args ?? {}), {
          headers,
        });
      }
      if (key === 'execute') {
        if (typeof body.confirmationId !== 'string') throw new Error('请先预览操作');
        return NextResponse.json(
          { result: await executeAction(user, body.confirmationId) },
          { headers },
        );
      }
    }
    return NextResponse.json({ error: '接口不存在' }, { status: 404, headers });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '请求失败' },
      { status: error instanceof UncertainWriteError ? 409 : 400, headers },
    );
  }
}
export const GET = (request: Request, context: { params: Promise<{ action: string[] }> }) =>
  route(request, 'GET', context);
export const POST = (request: Request, context: { params: Promise<{ action: string[] }> }) =>
  route(request, 'POST', context);
