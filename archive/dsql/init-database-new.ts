import { CloudFormationCustomResourceEvent, CloudFormationCustomResourceResponse } from 'aws-lambda'
import { Effect } from "effect"
import { Client } from "pg"
import { 
  DSQLClient, 
  GenerateDbConnectAdminAuthTokenCommand 
} from '@aws-sdk/client-dsql'

interface DatabaseInitResult {
  Status: 'SUCCESS' | 'FAILED'
  Reason?: string
  PhysicalResourceId: string
  Data?: Record<string, any>
}

async function createConnection(clusterArn: string, databaseName: string): Promise<Client> {
  console.log(`Connecting to DSQL cluster: ${clusterArn}`)
  
  // Extract cluster ID from ARN  
  const clusterId = clusterArn.split('/').pop()!
  const region = 'us-west-2'
  
  // DSQL endpoint format
  const hostname = `${clusterId}.dsql.${region}.on.aws`
  const port = 5432
  const username = 'admin'
  
  console.log(`Connecting to DSQL endpoint: ${hostname}:${port}`)
  
  // Create DSQL client
  const dsqlClient = new DSQLClient({ region })
  
  // Generate admin auth token using DSQL client
  const authToken = await dsqlClient.send(
    new GenerateDbConnectAdminAuthTokenCommand({
      hostname: hostname,
      expiresIn: 900,
    })
  )
  
  console.log(`Generated admin auth token, length: ${authToken.authToken?.length}`)

  // First try to connect to the default postgres database
  const client = new Client({
    host: hostname,
    port: port,
    user: username,
    password: authToken.authToken,
    database: 'postgres', // Connect to postgres database first
    ssl: {
      rejectUnauthorized: false,
    },
    // Add connection timeout
    connectionTimeoutMillis: 10000,
  })

  try {
    await client.connect()
    console.log(`Successfully connected to DSQL default database: postgres`)
    
    // Try to create our target database if it doesn't exist
    if (databaseName !== 'postgres') {
      try {
        console.log(`Creating database: ${databaseName}`)
        await client.query(`CREATE DATABASE ${databaseName}`)
        console.log(`Database ${databaseName} created successfully`)
      } catch (error: any) {
        if (error.code === '42P04') {
          console.log(`Database ${databaseName} already exists`)
        } else {
          console.log(`Failed to create database ${databaseName}:`, error.message)
        }
      }
      
      // Close connection to default database
      await client.end()
      
      // Now connect to our target database
      const targetClient = new Client({
        host: hostname,
        port: port,
        user: username,
        password: authToken.authToken,
        database: databaseName,
        ssl: {
          rejectUnauthorized: false,
        },
        connectionTimeoutMillis: 10000,
      })
      
      await targetClient.connect()
      console.log(`Successfully connected to target database: ${databaseName}`)
      return targetClient
    }
    
    return client
  } catch (error) {
    console.error(`Failed to connect to DSQL:`, error)
    throw error
  }
}

async function initializeDatabase(client: Client): Promise<void> {
  console.log('Initializing database schema...')
  
  // Create users table if it doesn't exist
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `

  await client.query(createTableSQL)
  console.log('Users table created/verified successfully')
  
  // Insert test user if it doesn't exist
  const insertTestUserSQL = `
    INSERT INTO users (id, name, created_at, updated_at)
    VALUES ('test', 'Test User', '2024-01-01 00:00:00', '2024-01-01 00:00:00')
    ON CONFLICT (id) DO NOTHING
  `
  
  await client.query(insertTestUserSQL)
  console.log('Test user inserted/verified successfully')
  
  // Verify the setup
  const countResult = await client.query('SELECT COUNT(*) as count FROM users')
  console.log(`Database initialized with ${countResult.rows[0].count} users`)
}

export const handler = async (
  event: CloudFormationCustomResourceEvent
): Promise<CloudFormationCustomResourceResponse> => {
  console.log('Database initialization Lambda invoked', { event })

  const clusterArn = process.env.DSQL_CLUSTER_ARN || ''
  const databaseName = process.env.DSQL_DATABASE_NAME || 'users_db'
  
  try {
    if (event.RequestType === 'Delete') {
      // For delete operations, just return success
      console.log('Delete operation - no cleanup needed')
      return {
        Status: 'SUCCESS',
        Reason: 'Delete operation completed',
        PhysicalResourceId: 'dsql-db-init',
        StackId: event.StackId,
        RequestId: event.RequestId,
        LogicalResourceId: event.LogicalResourceId,
      }
    }

    if (!clusterArn || clusterArn === '') {
      throw new Error('DSQL_CLUSTER_ARN environment variable is required')
    }

    console.log(`Initializing DSQL database: ${databaseName} on cluster: ${clusterArn}`)
    
    let client: Client | null = null
    
    try {
      client = await createConnection(clusterArn, databaseName)
      await initializeDatabase(client)
      
      console.log('Database initialization completed successfully')
      
      return {
        Status: 'SUCCESS',
        Reason: 'Database initialized successfully',
        PhysicalResourceId: 'dsql-db-init',
        StackId: event.StackId,
        RequestId: event.RequestId,
        LogicalResourceId: event.LogicalResourceId,
        Data: {
          DatabaseName: databaseName,
          ClusterArn: clusterArn,
          Status: 'Initialized'
        }
      }
    } finally {
      if (client) {
        await client.end()
        console.log('Database connection closed')
      }
    }
  } catch (error) {
    console.error('Database initialization failed:', error)
    
    return {
      Status: 'FAILED',
      Reason: `Database initialization failed: ${error}`,
      PhysicalResourceId: 'dsql-db-init',
      StackId: event.StackId,
      RequestId: event.RequestId,
      LogicalResourceId: event.LogicalResourceId,
    }
  }
}
