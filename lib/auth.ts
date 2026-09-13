import { betterAuth } from 'better-auth'
import { username } from 'better-auth/plugins'
import { createAuthClient } from 'better-auth/react'
import { usernameClient } from 'better-auth/client/plugins'
import { PostgresDialect } from 'kysely'
import { Pool } from 'pg'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('Missing DATABASE_URL environment variable')
}

const pool = new Pool({ connectionString })

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET || 'dev-better-auth-secret-change-me-32chars',
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:8443',
  database: {
    dialect: new PostgresDialect({ pool }),
    type: 'postgres',
    schema: 'public',
  },
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    username(),
  ],
  user: {
    modelName: 'users',
    fields: {
      id: 'id',
      name: 'name',
      email: 'email',
      emailVerified: 'email_verified',
      image: 'image',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    additionalFields: {
      username: {
        type: 'string',
        required: true,
        input: true,
        unique: true,
      },
      role: {
        type: 'string',
        required: true,
        input: true,
      },
      restaurant: {
        type: 'string',
        required: true,
        defaultValue: 'Both',
        input: true,
      },
    },
  },
  session: {
    modelName: 'session',
    fields: {
      userId: 'user_id',
      token: 'token',
      expiresAt: 'expires_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      ipAddress: 'ip_address',
      userAgent: 'user_agent',
    },
  },
  account: {
    modelName: 'account',
    fields: {
      accountId: 'account_id',
      providerId: 'provider_id',
      userId: 'user_id',
      accessToken: 'access_token',
      refreshToken: 'refresh_token',
      idToken: 'id_token',
      accessTokenExpiresAt: 'access_token_expires_at',
      refreshTokenExpiresAt: 'refresh_token_expires_at',
      scope: 'scope',
      password: 'password',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
  verification: {
    modelName: 'verification',
    fields: {
      identifier: 'identifier',
      value: 'value',
      expiresAt: 'expires_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
  advanced: {
    database: {
      generateId: 'uuid',
      validateSchema: false,
    },
  },
})

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || 'http://localhost:8443',
  fetchOptions: {
    credentials: 'include',
  },
  plugins: [usernameClient()],
})

export default auth
