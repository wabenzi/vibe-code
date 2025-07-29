import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { Effect, Schema } from 'effect'
import { CreateUserRequest, ValidationError, UserResponse } from '../domain/user'
import { createUserService } from '../services/dynamo-user-service'
import { ApiResponse } from './types/api-response'
import { handleCreateUserError } from './utils/error-handler'

// Define a schema for the raw request body to leverage Effect's validation
const RawCreateUserRequest = Schema.Struct({
  id: Schema.NonEmptyString,
  name: Schema.NonEmptyString,
})

// Effect-based request parsing and validation using pipe composition
const parseRequestBody = (body: string | null) => {
  if (!body) {
    return Effect.fail(new ValidationError({
      message: 'Request body is required',
      errors: ['Request body cannot be empty'],
    }))
  }

  return Effect.try({
    try: () => JSON.parse(body),
    catch: () => new ValidationError({
      message: 'Invalid JSON in request body',
      errors: ['Body must be valid JSON'],
    })
  }).pipe(
    Effect.flatMap(parsed => 
      Schema.decodeUnknown(RawCreateUserRequest)(parsed).pipe(
        Effect.mapError((parseError) => {
          const errorMessage = parseError.message || 'Validation failed'
          return new ValidationError({
            message: 'Request validation failed',
            errors: [errorMessage],
          })
        })
      )
    ),
    Effect.map(validatedData => new CreateUserRequest({
      id: validatedData.id,
      name: validatedData.name,
    }))
  )
}

// Effect-based user creation pipeline using pipe composition
const createUserProgram = (event: APIGatewayProxyEvent) => {
  console.log('Create User Lambda invoked', { event })
  
  return parseRequestBody(event.body).pipe(
    Effect.flatMap(createUserRequest => {
      const userService = createUserService()
      return userService.createUser(createUserRequest)
    }),
    Effect.map(user => new UserResponse({
      id: user.id,
      name: user.name,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    }))
  )
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  return await Effect.runPromise(
    createUserProgram(event).pipe(
      Effect.map(userResponse => ApiResponse.created(userResponse)),
      Effect.catchAll((error) => Effect.succeed(handleCreateUserError(error))),
      Effect.scoped
    )
  )
}
