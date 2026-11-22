export interface IStorageDriver {
  get<T>(key: string, defaultValue?: T): Promise<T | null>;
  set<T>(key: string, value: T): Promise<boolean>;
  remove(key: string): Promise<boolean>;
  clear?(): Promise<boolean>;
}
