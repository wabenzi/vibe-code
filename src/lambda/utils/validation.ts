import { APIGatewayProxyEvent } from 'aws-lambda'
import { Effect, Schema } from 'effect'
import { ValidationError } from '../../domain/user'

// Schema for user ID validation
export const UserIdParam = Schema.NonEmptyString.pipe(
  Schema.filter((id) => !id.includes('/') && !id.includes('?') && !id.includes('#') && !id.includes('%') && id.length <= 100, {
    message: () => 'Invalid user ID format'
  })
)

// Effect-based user ID extraction and validation
export const extractUserId = (event: APIGatewayProxyEvent) => {
  const userId = event.pathParameters?.id

  if (!userId) {
    return Effect.fail(new ValidationError({
      message: 'User ID is required',
      errors: ['User ID parameter is missing'],
    }))
  }

  return Schema.decodeUnknown(UserIdParam)(userId).pipe(
    Effect.mapError(() => new ValidationError({
      message: 'Invalid user ID format',
      errors: ['User ID contains invalid characters or is too long'],
    }))
  )
}
