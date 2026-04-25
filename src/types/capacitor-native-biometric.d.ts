declare module 'capacitor-native-biometric' {
  export interface IsAvailableResult {
    isAvailable: boolean;
    biometryType: number;
    errorCode?: number;
  }

  export interface VerifyIdentityOptions {
    reason?: string;
    title?: string;
    subtitle?: string;
    description?: string;
    negativeButtonText?: string;
    useFallback?: boolean;
    fallbackTitle?: string;
    maxAttempts?: number;
  }

  export interface SetCredentialsOptions {
    username: string;
    password: string;
    server: string;
  }

  export interface GetCredentialsOptions {
    server: string;
  }

  export interface Credentials {
    username: string;
    password: string;
  }

  export interface DeleteCredentialsOptions {
    server: string;
  }

  export const NativeBiometric: {
    isAvailable(): Promise<IsAvailableResult>;
    verifyIdentity(options?: VerifyIdentityOptions): Promise<void>;
    setCredentials(options: SetCredentialsOptions): Promise<void>;
    getCredentials(options: GetCredentialsOptions): Promise<Credentials>;
    deleteCredentials(options: DeleteCredentialsOptions): Promise<void>;
  };
}
