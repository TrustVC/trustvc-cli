// Re-export mint command from token-registry to make it available as 'trustvc mint'
export { command, describe, handler } from './token-registry/mint';
