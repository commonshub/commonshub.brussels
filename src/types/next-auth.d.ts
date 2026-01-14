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
  }
}
