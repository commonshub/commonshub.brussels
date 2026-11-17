import "next-auth"
import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      discordId: string
      username: string
      discriminator: string
      avatar: string
      roles: string[]
      roleDetails: Array<{ id: string; name: string }>
      accessToken: string
      /** Signed in with an email address and a code: the Odoo partner it belongs to (no Discord). */
      odooPartnerId?: number
      authMethod?: "discord" | "email"
    } & DefaultSession["user"]
  }

  interface User {
    discordId: string
    username: string
    discriminator: string
    avatar: string
    roles: string[]
    roleDetails: Array<{ id: string; name: string }>
    accessToken: string
    odooPartnerId?: number
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    discordId: string
    username: string
    discriminator: string
    avatar: string
    roles: string[]
    roleDetails?: Array<{ id: string; name: string }>
    accessToken: string
    refreshToken?: string
    expiresAt?: number
    odooPartnerId?: number
    authMethod?: "discord" | "email"
  }
}
