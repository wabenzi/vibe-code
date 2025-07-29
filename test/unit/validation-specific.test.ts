import { Schema } from 'effect'
import { UserIdParam } from '../../src/lambda/utils/validation'

describe('Validation Schema Tests', () => {
  describe('UserIdParam schema validation', () => {
    it('should validate user ID that passes all filter conditions', () => {
      // Arrange - create a user ID that passes all filter conditions
      const validId = 'valid-user-123'

      // Act - directly test the schema validation
      const result = Schema.decodeUnknownSync(UserIdParam)(validId)

      // Assert
      expect(result).toBe(validId)
    })

    it('should validate user ID at exactly 100 characters', () => {
      // Arrange - create a user ID that is exactly 100 characters (passes length test)
      const exactLengthId = 'a'.repeat(100)

      // Act - directly test the schema validation
      const result = Schema.decodeUnknownSync(UserIdParam)(exactLengthId)

      // Assert
      expect(result).toBe(exactLengthId)
    })

    it('should reject user ID that fails the filter - slash character', () => {
      // Arrange
      const invalidId = 'user/with/slash'

      // Act & Assert
      expect(() => Schema.decodeUnknownSync(UserIdParam)(invalidId)).toThrow()
    })

    it('should reject user ID that fails the filter - question mark', () => {
      // Arrange
      const invalidId = 'user?with?query'

      // Act & Assert
      expect(() => Schema.decodeUnknownSync(UserIdParam)(invalidId)).toThrow()
    })

    it('should reject user ID that fails the filter - hash character', () => {
      // Arrange
      const invalidId = 'user#with#hash'

      // Act & Assert
      expect(() => Schema.decodeUnknownSync(UserIdParam)(invalidId)).toThrow()
    })

    it('should reject user ID that fails the filter - percent character', () => {
      // Arrange
      const invalidId = 'user%with%percent'

      // Act & Assert
      expect(() => Schema.decodeUnknownSync(UserIdParam)(invalidId)).toThrow()
    })

    it('should reject user ID that fails the filter - too long', () => {
      // Arrange
      const tooLongId = 'a'.repeat(101) // 101 characters

      // Act & Assert
      expect(() => Schema.decodeUnknownSync(UserIdParam)(tooLongId)).toThrow()
    })

    it('should test filter function boundary conditions', () => {
      // Test cases that exercise different combinations of the filter conditions
      const testCases = [
        { id: 'a', shouldPass: true, description: 'single character' },
        { id: 'user-123', shouldPass: true, description: 'valid user ID with dash and numbers' },
        { id: 'user_test', shouldPass: true, description: 'valid user ID with underscore' },
        { id: 'UserTest', shouldPass: true, description: 'valid user ID with mixed case' },
        { id: '123456', shouldPass: true, description: 'numeric only' },
        { id: 'user.test', shouldPass: true, description: 'valid user ID with dot' },
        { id: 'user@test', shouldPass: true, description: 'valid user ID with at symbol' },
        { id: 'user+test', shouldPass: true, description: 'valid user ID with plus' },
      ]

      testCases.forEach(({ id, shouldPass, description }) => {
        if (shouldPass) {
          expect(() => Schema.decodeUnknownSync(UserIdParam)(id)).not.toThrow()
        } else {
          expect(() => Schema.decodeUnknownSync(UserIdParam)(id)).toThrow()
        }
      })
    })
  })
})
