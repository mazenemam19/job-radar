export interface AppHeaderProps {
  lastUpdated?: string;
  onRefresh?: () => Promise<void>;
  cronSecret?: string;
}
