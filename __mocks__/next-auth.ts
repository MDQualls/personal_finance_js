// Manual mock for next-auth — used by all API route tests.
// Routes import getServerSession from this shared mock instance;
// lib/__mocks__/auth.ts controls it via mockSession/noSession.
export const getServerSession = jest.fn()
