import { Given, When, Then, Before, After, DataTable } from '@cucumber/cucumber';
import { ApiClient, createTestUser, getApiUrl } from '../../utils/api-client';
import { AxiosResponse, AxiosError } from 'axios';
import { expect } from '@jest/globals';

interface UserResponse {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

interface TestContext {
  apiClient: ApiClient;
  lastResponse?: AxiosResponse<UserResponse>;
  lastError?: AxiosError;
  createdUsers: string[];
  requestStartTime?: number;
  concurrentResponses?: AxiosResponse<UserResponse>[];
}

// World context for sharing state between steps
let testContext: TestContext;

Before(async function () {
  testContext = {
    apiClient: new ApiClient(getApiUrl()),
    createdUsers: [],
  };
});

After(async function () {
  // Clean up created test users
  for (const userId of testContext.createdUsers) {
    try {
      await testContext.apiClient.deleteUser(userId);
    } catch (error) {
      // Ignore cleanup errors
      console.warn(`Failed to cleanup user ${userId}`);
    }
  }
});

Given('the API is available', async function () {
  // Simple health check or ensure API is responding
  try {
    await testContext.apiClient.getUser('health-check');
  } catch (error) {
    // API is available even if health-check user doesn't exist
    const axiosError = error as AxiosError;
    if (axiosError.response?.status !== 404) {
      throw new Error('API is not available');
    }
  }
});

Given('a user exists with id {string} and name {string}', async function (userId: string, userName: string) {
  try {
    const response = await testContext.apiClient.createUser({ id: userId, name: userName });
    testContext.createdUsers.push(userId);
    expect(response.status).toBe(201);
  } catch (error) {
    throw new Error(`Failed to create prerequisite user: ${error}`);
  }
});

When('I create a user with id {string} and name {string}', async function (userId: string, userName: string) {
  testContext.requestStartTime = Date.now();
  
  try {
    testContext.lastResponse = await testContext.apiClient.createUser({ id: userId, name: userName });
    testContext.createdUsers.push(userId);
    testContext.lastError = undefined;
  } catch (error) {
    testContext.lastError = error as AxiosError;
    testContext.lastResponse = undefined;
  }
});

When('I request the user with id {string}', async function (userId: string) {
  testContext.requestStartTime = Date.now();
  
  try {
    testContext.lastResponse = await testContext.apiClient.getUser(userId);
    testContext.lastError = undefined;
  } catch (error) {
    testContext.lastError = error as AxiosError;
    testContext.lastResponse = undefined;
  }
});

When('I create multiple users concurrently:', async function (dataTable: DataTable) {
  const users = dataTable.hashes();
  testContext.requestStartTime = Date.now();
  
  const createPromises = users.map(user => 
    testContext.apiClient.createUser({ id: user.userId, name: user.userName })
  );
  
  try {
    testContext.concurrentResponses = await Promise.all(createPromises);
    users.forEach(user => testContext.createdUsers.push(user.userId));
    testContext.lastError = undefined;
  } catch (error) {
    testContext.lastError = error as AxiosError;
    testContext.concurrentResponses = undefined;
  }
});

Then('the response status should be {int}', function (expectedStatus: number) {
  if (testContext.lastResponse) {
    expect(testContext.lastResponse.status).toBe(expectedStatus);
  } else if (testContext.lastError) {
    expect(testContext.lastError.response?.status).toBe(expectedStatus);
  } else {
    throw new Error('No response or error found');
  }
});

Then('the response should contain the user with id {string}', function (expectedId: string) {
  expect(testContext.lastResponse).toBeDefined();
  expect(testContext.lastResponse!.data.id).toBe(expectedId);
});

Then('the response should contain the user with name {string}', function (expectedName: string) {
  expect(testContext.lastResponse).toBeDefined();
  expect(testContext.lastResponse!.data.name).toBe(expectedName);
});

Then('the response should contain timestamps', function () {
  expect(testContext.lastResponse).toBeDefined();
  expect(testContext.lastResponse!.data.createdAt).toBeDefined();
  expect(testContext.lastResponse!.data.updatedAt).toBeDefined();
  
  // Validate timestamp format
  expect(new Date(testContext.lastResponse!.data.createdAt)).toBeInstanceOf(Date);
  expect(new Date(testContext.lastResponse!.data.updatedAt)).toBeInstanceOf(Date);
});

Then('the response should contain an error message', function () {
  expect(testContext.lastError).toBeDefined();
  expect(testContext.lastError!.response?.data).toHaveProperty('error');
});

Then('the response should contain a validation error', function () {
  expect(testContext.lastError).toBeDefined();
  expect(testContext.lastError!.response?.status).toBe(400);
  expect(testContext.lastError!.response?.data).toHaveProperty('error');
});

Then('the creation and update timestamps should be the same', function () {
  expect(testContext.lastResponse).toBeDefined();
  expect(testContext.lastResponse!.data.createdAt).toBe(testContext.lastResponse!.data.updatedAt);
});

Then('all users should be created successfully', function () {
  expect(testContext.concurrentResponses).toBeDefined();
  expect(testContext.concurrentResponses!.length).toBeGreaterThan(0);
  
  testContext.concurrentResponses!.forEach(response => {
    expect(response.status).toBe(201);
  });
});

Then('each user should be retrievable individually', async function () {
  expect(testContext.concurrentResponses).toBeDefined();
  
  for (const response of testContext.concurrentResponses!) {
    const getResponse = await testContext.apiClient.getUser(response.data.id);
    expect(getResponse.status).toBe(200);
    expect(getResponse.data.id).toBe(response.data.id);
    expect(getResponse.data.name).toBe(response.data.name);
  }
});

Then('the response should be received within {int} seconds', function (maxSeconds: number) {
  expect(testContext.requestStartTime).toBeDefined();
  
  const responseTime = Date.now() - testContext.requestStartTime!;
  const maxMilliseconds = maxSeconds * 1000;
  
  expect(responseTime).toBeLessThan(maxMilliseconds);
});
