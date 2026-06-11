// auth.ts
import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { prisma } from "@/lib/prisma"

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false

      // Check if user exists in database
      const dbUser = await prisma.user.findUnique({
        where: { email: user.email },
      })

      if (!dbUser) {
        // If user doesn't exist, create them as ADMIN with empty passwordHash
        await prisma.user.create({
          data: {
            name: user.name || user.email.split('@')[0],
            email: user.email,
            passwordHash: '', // dummy password hash for Google OAuth users
            role: 'ADMIN',
          },
        })
      }

      return true
    },
    async jwt({ token, user }) {
      if (user && user.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email },
        })
        if (dbUser) {
          token.id = dbUser.id
          token.role = dbUser.role
          token.name = dbUser.name
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        // @ts-ignore
        session.user.role = token.role as string
        session.user.name = token.name as string
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
})
