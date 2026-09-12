import { promises as fs } from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';

const storePath = path.join(process.cwd(), 'data', 'accounts.json');

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

export async function GET(request) {
  const email = String(new URL(request.url).searchParams.get('email') || '').trim().toLowerCase();
  if (!email) return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
  const store = await readStore();
  return NextResponse.json({ account: store[email] || null });
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const email = String(body.email || '').trim().toLowerCase();
  if (!email || !body.user || !body.passwordHash) {
    return NextResponse.json({ error: 'Email, user, and passwordHash are required.' }, { status: 400 });
  }

  const store = await readStore();
  if (store[email] && body.mode === 'register') {
    return NextResponse.json({ error: 'Account already exists.' }, { status: 409 });
  }
  store[email] = {
    ...(store[email] || {}),
    user: body.user,
    passwordHash: body.passwordHash,
    updatedAt: new Date().toISOString(),
  };
  await writeStore(store);
  return NextResponse.json({ success: true, account: store[email] });
}
