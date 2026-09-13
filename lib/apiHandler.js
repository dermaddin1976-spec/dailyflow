import { NextResponse } from 'next/server';

// Wraps a route handler so an error that isn't already handled inside it —
// a dropped DB connection, a bad query, anything unexpected — comes back
// as a plain JSON error instead of Next's raw HTML crash page. Every
// fetch() call in this app expects to be able to res.json() the response
// no matter what happened server-side; without this, a transient Postgres
// hiccup turns into a client-side "Unexpected token '<'" instead of a
// message someone can actually read.
export function withApi(handler) {
  return async function wrapped(...args) {
    try {
      return await handler(...args);
    } catch (err) {
      console.error('[api error]', err);
      return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
    }
  };
}
