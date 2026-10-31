import { PostgrestClient } from '@supabase/postgrest-js';
import type { AppUser } from '@shared/ipc';
import { API_URL } from '../generated/api-config';

export type LoginResult = {
  token: string;
  expires_at: number;
  user: AppUser;
};

/** A PostgREST (or transport) failure, kept raw so the IPC layer can map it. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly pgCode: string | undefined,
    readonly status: number | undefined,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type PgResponse<T> = {
  data: T | null;
  error: { code?: string; message?: string } | null;
  status?: number;
};

/** Returns data or throws ApiError. */
export function unwrap<T>(res: PgResponse<T>): T {
  if (res.error) throw new ApiError(res.error.message ?? '', res.error.code, res.status);
  return res.data as T;
}

export class DbClient {
  readonly rest: PostgrestClient<any, any, any>;
  // The current user's JWT. Lives only in the main process; the renderer
  // never sees it.
  private token: string | null = null;
  private onSessionExpired: (() => void) | null = null;

  constructor() {
    this.rest = new PostgrestClient(`${API_URL}/rest/v1`, {
      fetch: (input: any, init?: any) => this.authFetch(input, init),
    });
  }

  private async authFetch(input: any, init: any = {}): Promise<Response> {
    const token = this.token;
    const headers = new Headers(init.headers);
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    } else {
      headers.delete('Authorization');
    }

    const response = await fetch(input, { ...init, headers });

    // Expired token, password/role changed, or user deleted.
    if (response.status === 401 && token && token === this.token) {
      this.token = null;
      this.onSessionExpired?.();
    }
    return response;
  }

  // --- Session ------------------------------------------------------------

  setSessionExpiredHandler(handler: () => void): void {
    this.onSessionExpired = handler;
  }

  setToken(token: string | null): void {
    this.token = token;
  }

  hasSession(): boolean {
    return this.token !== null;
  }

  /** Resolves to null for wrong credentials; throws ApiError otherwise. */
  async login(username: string, password: string, remember: boolean): Promise<LoginResult | null> {
    this.token = null;
    const res = await this.rest.rpc('login', { username, password, remember });
    const data = unwrap(res as PgResponse<LoginResult>);
    if (!data) return null;
    this.token = data.token;
    return data;
  }

  /** The user for the current token, or null if the token is not valid. */
  async me(): Promise<AppUser | null> {
    const { data, error } = await this.rest.rpc('me');
    if (error || !data) return null;
    return data as AppUser;
  }
}

export const db = new DbClient();
