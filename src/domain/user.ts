import { Schema } from "effect"

// User Schema
export class User extends Schema.Class<User>("User")({
  id: Schema.String,
  name: Schema.String,
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
}) {}

// Create User Request Schema
export class CreateUserRequest extends Schema.Class<CreateUserRequest>("CreateUserRequest")({
  id: Schema.String,
  name: Schema.String,
}) {}

// User Response Schema
export class UserResponse extends Schema.Class<UserResponse>("UserResponse")({
  id: Schema.String,
  name: Schema.String,
  createdAt: Schema.String,
  updatedAt: Schema.String,
}) {}

// Error Schemas
export class UserNotFoundError extends Schema.TaggedError<UserNotFoundError>()(
  "UserNotFoundError",
  {
    message: Schema.String,
    userId: Schema.String,
  }
) {}

export class DatabaseError extends Schema.TaggedError<DatabaseError>()(
  "DatabaseError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}

export class ValidationError extends Schema.TaggedError<ValidationError>()(
  "ValidationError",
  {
    message: Schema.String,
    errors: Schema.Array(Schema.String),
  }
) {}
