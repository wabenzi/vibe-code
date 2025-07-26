import { Effect, Layer } from "effect"
import { CreateUserRequest, User, UserNotFoundError } from "../domain/user"
import { UserRepository, DynamoUserRepository, DynamoUserRepositoryError } from "../infrastructure/dynamo-user-repository"

export interface UserService {
  readonly createUser: (request: CreateUserRequest) => Effect.Effect<User, DynamoUserRepositoryError>
  readonly getUserById: (id: string) => Effect.Effect<User, UserNotFoundError | DynamoUserRepositoryError>
  readonly getAllUsers: () => Effect.Effect<readonly User[], DynamoUserRepositoryError>
  readonly deleteUser: (id: string) => Effect.Effect<void, UserNotFoundError | DynamoUserRepositoryError>
}

export const DynamoUserService: UserService = {
  createUser: (request: CreateUserRequest) => DynamoUserRepository.create(request),
  getUserById: (id: string) => DynamoUserRepository.findById(id),
  getAllUsers: () => DynamoUserRepository.findAll(),
  deleteUser: (id: string) => DynamoUserRepository.deleteById(id),
}

// Simple service implementation without layers for now
export const createUserService = (): UserService => DynamoUserService
