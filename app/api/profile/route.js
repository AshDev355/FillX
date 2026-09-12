import { promises as fs } from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';

const storePath = path.join(process.cwd(), 'data', 'profiles.json');

async function readStore() {
  try {
    return JSON.parse(await fs.readFile(storePath, 'utf8'));
  } catch {
    return {};
  }
}

async function writeStore(store) {
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  await fs.writeFile(storePath, JSON.stringify(store, null, 2), 'utf8');
}

function getEmail(request, body = {}) {
  return String(body.email || request.headers.get('x-fillx-account') || '').trim().toLowerCase();
}

export async function GET(request) {
  const email = getEmail(request);
  if (!email) return NextResponse.json({ error: 'Account email is required.' }, { status: 400 });
  const store = await readStore();
  return NextResponse.json({ email, profile: store[email] || null });
}

export async function PUT(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const email = getEmail(request, body);
  if (!email || !body.profile || typeof body.profile !== 'object') {
    return NextResponse.json({ error: 'Account email and profile are required.' }, { status: 400 });
  }

  const store = await readStore();
  store[email] = {
    ...body.profile,
    meta: {
      ...(body.profile.meta || {}),
      lastUpdated: new Date().toISOString(),
    },
  };
  await writeStore(store);
  return NextResponse.json({ success: true, email, profile: store[email] });
}
