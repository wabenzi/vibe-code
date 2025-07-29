import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { Effect, Exit } from 'effect'
import { CreateUserRequest, ValidationError, UserResponse } from '../domain/user'
import { createUserService } from '../services/dynamo-user-service'
import { ApiResponse } from './types/api-response'

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Create User Lambda invoked', { event })

  try {
    // Parse request body
    if (!event.body) {
      return ApiResponse.badRequest('Request body is required')
    }

    let requestData
    try {
      requestData = JSON.parse(event.body)
    } catch (parseError) {
      return ApiResponse.badRequest('Invalid JSON in request body')
    }
    
    // Validate required fields
    if (!requestData.id || !requestData.name) {
      const details = {
        id: !requestData.id ? 'id is required' : null,
        name: !requestData.name ? 'name is required' : null,
      }
      return ApiResponse.validationError('Missing required fields: id and name are required', details)
    }

    // Validate data types
    if (typeof requestData.id !== 'string' || typeof requestData.name !== 'string') {
      const details = {
        id: typeof requestData.id !== 'string' ? 'id must be a string' : null,
        name: typeof requestData.name !== 'string' ? 'name must be a string' : null,
      }
      return ApiResponse.validationError('Invalid data types', details)
    }
    
    // Create request object
    const createUserRequest = new CreateUserRequest({
      id: requestData.id,
      name: requestData.name,
    })

    // Execute the Effect program with proper error handling
    const userService = createUserService()
    const exit = await Effect.runPromiseExit(userService.createUser(createUserRequest))

    if (Exit.isFailure(exit)) {
      const error = exit.cause._tag === 'Fail' ? exit.cause.error : exit.cause
      console.error('Effect error creating user:', error)
      
      // Handle typed Effect errors
      if (error && typeof error === 'object' && '_tag' in error) {
        switch (error._tag) {
          case 'DynamoUserRepositoryError':
            return ApiResponse.databaseError((error as any).message)
        }
      }
      
      return ApiResponse.internalServerError(
        'Internal server error',
        typeof error === 'string' ? error : 'Unknown error'
      )
    }

    const result = exit.value

    // Convert to response format
    const userResponse = new UserResponse({
      id: result.id,
      name: result.name,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    })

    return ApiResponse.created(userResponse)

  } catch (error) {
    console.error('Error creating user:', error)

    // Handle different types of errors
    if (error instanceof ValidationError) {
      return ApiResponse.validationError(error.message, error.errors)
    }

    // Generic error handling
    return ApiResponse.internalServerError(
      'Internal server error',
      error instanceof Error ? error.message : 'Unknown error'
    )
  }
}
