Feature: User Management API
  As a client application
  I want to manage users through the API
  So that I can create and retrieve user information

  Background:
    Given the API is available

  Scenario: Create a new user with valid data
    When I create a user with id "test-user-123" and name "John Doe"
    Then the response status should be 201
    And the response should contain the user with id "test-user-123"
    And the response should contain the user with name "John Doe"
    And the response should contain timestamps

  Scenario: Retrieve an existing user
    Given a user exists with id "existing-user" and name "Existing User"
    When I request the user with id "existing-user"
    Then the response status should be 200
    And the response should contain the user with id "existing-user"
    And the response should contain the user with name "Existing User"

  Scenario: Try to retrieve a non-existent user
    When I request the user with id "non-existent-user"
    Then the response status should be 404
    And the response should contain an error message

  Scenario: Create a user with invalid data
    When I create a user with id "" and name "Invalid User"
    Then the response status should be 400
    And the response should contain a validation error

  Scenario: Create a user with special characters
    When I create a user with id "special-chars-user" and name "User with Special !@#$%"
    Then the response status should be 201
    And the response should contain the user with name "User with Special !@#$%"

  Scenario Outline: Create users with different valid data
    When I create a user with id "<userId>" and name "<userName>"
    Then the response status should be 201
    And the response should contain the user with id "<userId>"
    And the response should contain the user with name "<userName>"

    Examples:
      | userId           | userName        |
      | short-id         | Short Name      |
      | very-long-user-id-123456789 | Very Long User Name With Spaces |
      | user_with_underscores | User With Underscores |
      | user-with-dashes | User With Dashes |

  Scenario: User lifecycle management
    When I create a user with id "lifecycle-user" and name "Lifecycle Test"
    Then the response status should be 201
    When I request the user with id "lifecycle-user"
    Then the response status should be 200
    And the response should contain the user with name "Lifecycle Test"
    And the creation and update timestamps should be the same

  Scenario: Concurrent user creation
    When I create multiple users concurrently:
      | userId      | userName    |
      | concurrent1 | Concurrent 1|
      | concurrent2 | Concurrent 2|
      | concurrent3 | Concurrent 3|
    Then all users should be created successfully
    And each user should be retrievable individually

  Scenario: API response time requirements
    When I create a user with id "performance-test" and name "Performance Test"
    Then the response should be received within 5 seconds
    And the response status should be 201
