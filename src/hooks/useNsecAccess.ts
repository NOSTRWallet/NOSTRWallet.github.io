import { useNostrLogin } from '@nostrify/react/login';
import { nip19 } from 'nostr-tools';

/**
 * Hook to check if the current user is logged in with nsec and get the private key.
 * Only works when user is logged in with nsec (not extension or bunker).
 */
export function useNsecAccess() {
  const { logins } = useNostrLogin();

  const currentLogin = logins[0];

  // Check if user is logged in with nsec
  const hasNsecAccess = currentLogin?.type === 'nsec';

  // Get the private key in hex format (only if nsec login)
  const getPrivateKey = (): string | null => {
    if (!hasNsecAccess || !currentLogin) return null;

    try {
      // The nsec is stored in the login data as 'data.nsec' property
      const loginData = currentLogin as { data?: { nsec: string } };
      const nsec = loginData.data?.nsec;

      if (!nsec) {
        console.error('No nsec found in login data');
        return null;
      }

      const decoded: { type: string; data: Uint8Array | string | object } = nip19.decode(nsec) as { type: string; data: Uint8Array | string | object };

      // Type guard to ensure we have an nsec
      if (decoded.type !== 'nsec') {
        console.error('Invalid nsec format, got type:', decoded.type);
        return null;
      }

      // Convert Uint8Array to hex string
      return Buffer.from(decoded.data as Uint8Array).toString('hex');
    } catch (error) {
      console.error('Failed to decode nsec:', error);
      return null;
    }
  };

  return {
    hasNsecAccess,
    getPrivateKey,
    loginType: currentLogin?.type,
  };
}
