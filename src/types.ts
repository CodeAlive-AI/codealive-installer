export interface WizardOptions {
  apiKey?: string;
  debug?: boolean;
  ci?: boolean;
}

export interface InstallResult {
  success: boolean;
  error?: string;
}

export interface VerifyResult {
  valid: boolean;
  message: string;
  datasourceCount?: number;
}

export type MCPServerConfig = Record<string, unknown>;

export type Platform = 'darwin' | 'linux' | 'win32';
