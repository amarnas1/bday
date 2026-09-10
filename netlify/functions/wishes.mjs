import { getStore } from '@netlify/blobs';
const MAX_WISHES = 80;
const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };

export default async (request) => {
    const store = getStore({ name: 'akshaya-birthday-wishes', consistency: 'strong' });
    try {
        if (request.method === 'GET') {
            const { blobs } = await store.list({ prefix: 'wish/' });
            const newest = blobs.sort((a, b) => b.key.localeCompare(a.key)).slice(0, MAX_WISHES);
            const wishes = (await Promise.all(newest.map(({ key }) => store.get(key, { type: 'json', consistency: 'strong' })))).filter(Boolean);
            return Response.json({ wishes }, { headers: jsonHeaders });
        }
        if (request.method === 'POST') {
            if (Number(request.headers.get('content-length') || 0) > 4096) return errorResponse('Request is too large.', 413);
            const body = await request.json();
            if (body.website) return Response.json({ ok: true }, { status: 201, headers: jsonHeaders });
            const name = cleanText(body.name, 40), message = cleanText(body.message, 280);
            if (!name || !message) return errorResponse('Please add your name and a wish.', 400);
            const wish = { id: crypto.randomUUID(), name, message, createdAt: new Date().toISOString() };
            await store.setJSON(`wish/${wish.createdAt}-${wish.id}`, wish, { onlyIfNew: true });
            return Response.json({ wish }, { status: 201, headers: jsonHeaders });
        }
        return errorResponse('Method not allowed.', 405, { Allow: 'GET, POST' });
    } catch (error) { console.error('Birthday wishes function failed:', error); return errorResponse('The wish wall is temporarily unavailable.', 500); }
};

function cleanText(value, max) { return typeof value === 'string' ? value.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : ''; }
function errorResponse(message, status, extra = {}) { return Response.json({ error: message }, { status, headers: { ...jsonHeaders, ...extra } }); }
export const config = { path: '/.netlify/functions/wishes' };
