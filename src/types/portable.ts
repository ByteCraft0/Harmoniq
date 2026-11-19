export interface PortableStatus {
  isPortable: boolean;
  dataDirectory: string;
  isWritable: boolean;
  standardDirectory: string;
  canSwitch: boolean;
  error?: string;
}

export interface MigrationResult {
  success: boolean;
  filesMigrated: number;
  sourceDir: string;
  targetDir: string;
  error?: string;
}

export interface DirectoryPermissionResult {
  writable: boolean;
  path: string;
  error?: string;
}
