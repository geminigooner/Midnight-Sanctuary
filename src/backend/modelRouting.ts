export interface ModelRoute {
  provider: 'google' | 'anthropic' | 'openai' | 'custom';
  endpointUrl?: string;
  credentialEnvName: string; // e.g., 'GEMINI_API_KEY' - never exposed to frontend
  fallbackRoute?: ModelRoute;
}

// Placeholder routing table - intentionally empty for Model System v1 groundwork
const ROUTING_TABLE: Record<string, ModelRoute> = {};

/**
 * Resolves the backend routing information for a given model identity.
 * This function and its return type MUST NEVER be exposed to the frontend.
 */
export function resolveModelRoute(identityId: string): ModelRoute | undefined {
  return ROUTING_TABLE[identityId];
}
