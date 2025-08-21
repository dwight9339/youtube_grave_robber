# Server-Side Caching

In this sprint we'll be implementing server-side caching! This way we can cache unused search results from different browser sessions and get the most out of our API credits and build up a massive backlog of leads to videos from the graveyard.

## Strategy
- Create a simple cache provider interface to allow dependency injection for flexibility.
- Implement a DynamoDB provider (since we're targeting a Lambda backend for now.
