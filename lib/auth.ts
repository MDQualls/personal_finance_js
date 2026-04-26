import { type NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null

        const expectedUsername = process.env.AUTH_USERNAME
        const passwordHashB64 = process.env.AUTH_PASSWORD_HASH_B64
        if (!expectedUsername || !passwordHashB64) return null

        const passwordHash = Buffer.from(passwordHashB64, 'base64').toString('utf8')

        const usernameMatch = credentials.username === expectedUsername
        const passwordMatch = await bcrypt.compare(credentials.password, passwordHash)

        if (!usernameMatch || !passwordMatch) return null

        return { id: '1', name: credentials.username, email: null }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/auth/signin',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as { id?: string }).id = token.id as string
      }
      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
}
