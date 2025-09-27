export const SETTINGS_QUERY_KEY = ["/api/settings"] as const;
export const DEFAULT_PAGE_SIZE = 15;

export type SettingsData = {
  pageSize: number;
};
