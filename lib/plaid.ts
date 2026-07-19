import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid'

// PLAID_ENV is validated at request time by Plaid rejecting an unknown basePath —
// narrowing here avoids a broader `any` on the PlaidEnvironments lookup.
const env = (process.env.PLAID_ENV ?? 'sandbox') as keyof typeof PlaidEnvironments

const configuration = new Configuration({
  basePath: PlaidEnvironments[env],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID ?? '',
      'PLAID-SECRET': process.env.PLAID_SECRET ?? '',
    },
  },
})

// Server-only singleton — never import this from a client component.
export const plaidClient = new PlaidApi(configuration)
