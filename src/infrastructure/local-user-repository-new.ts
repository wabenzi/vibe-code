import { Effect, Context } from "effect"
import { Client } from "pg"
import { User, UserNotFoundError, DatabaseError } from "../domain/user"

export interface LocalUserRepository {
  create(user: User): Effect.Effect<User, DatabaseError>
  findById(id: string): Effect.Effect<User, UserNotFoundError | DatabaseError>
}

export const LocalUserRepository = Context.GenericTag<LocalUserRepository>("LocalUserRepository")

export const makeLocalUserRepository = (): Effect.Effect<LocalUserRepository, never> =>
  Effect.succeed({
    create: (user: User): Effect.Effect<User, DatabaseError> =>
      Effect.tryPromise({
        try: async () => {
          const client = new Client({
            host: process.env.POSTGRES_HOST || 'localhost',
            port: parseInt(process.env.POSTGRES_PORT || '5432'),
            database: process.env.POSTGRES_DB || 'users_db',
            user: process.env.POSTGRES_USER || 'testuser',
            password: process.env.POSTGRES_PASSWORD || 'testpass'
          })

          try {
            await client.connect()
            
            const query = `
              INSERT INTO users (id, name, created_at, updated_at) 
              VALUES ($1, $2, $3, $4) 
              RETURNING *
            `
            const values = [user.id, user.name, user.createdAt, user.updatedAt]
            
            const result = await client.query(query, values)
            
            if (result.rows.length === 0) {
              throw new Error("Failed to create user")
            }

            const row = result.rows[0]
            return new User({
              id: row.id,
              name: row.name,
              createdAt: new Date(row.created_at),
              updatedAt: new Date(row.updated_at)
            })
          } finally {
            await client.end().catch(() => {})
          }
        },
        catch: (error) => new DatabaseError({ 
          message: `Database error: ${error instanceof Error ? error.message : 'Unknown error'}` 
        })
      }),

    findById: (id: string): Effect.Effect<User, UserNotFoundError | DatabaseError> =>
      Effect.tryPromise({
        try: async () => {
          const client = new Client({
            host: process.env.POSTGRES_HOST || 'localhost',
            port: parseInt(process.env.POSTGRES_PORT || '5432'),
            database: process.env.POSTGRES_DB || 'users_db',
            user: process.env.POSTGRES_USER || 'testuser',
            password: process.env.POSTGRES_PASSWORD || 'testpass'
          })

          try {
            await client.connect()
            
            const query = 'SELECT * FROM users WHERE id = $1'
            const result = await client.query(query, [id])
            
            if (result.rows.length === 0) {
              throw new UserNotFoundError({ 
                message: `User with id ${id} not found`,
                userId: id 
              })
            }

            const row = result.rows[0]
            return new User({
              id: row.id,
              name: row.name,
              createdAt: new Date(row.created_at),
              updatedAt: new Date(row.updated_at)
            })
          } finally {
            await client.end().catch(() => {})
          }
        },
        catch: (error) => {
          if (error instanceof UserNotFoundError) {
            return error
          }
          return new DatabaseError({ 
            message: `Database error: ${error instanceof Error ? error.message : 'Unknown error'}` 
          })
        }
      })
  })
