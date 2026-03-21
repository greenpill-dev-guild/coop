import { useCallback, useEffect, useMemo, useState } from 'react';
import { type DashboardResponse, sendRuntimeMessage } from '../../../runtime/messages';
import {
  selectActiveCoop,
  selectActiveMember,
  selectAggregateArtifacts,
  selectAggregateReadyDrafts,
  selectAggregateVisibleDrafts,
  selectReadyDrafts,
  selectRecentArtifacts,
  selectVisibleDrafts,
} from '../../shared/dashboard-selectors';

export function usePopupDashboard() {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const loadDashboard = useCallback(async () => {
    const response = await sendRuntimeMessage<DashboardResponse>({ type: 'get-dashboard' });
    if (response.ok && response.data) {
      setDashboard(response.data);
      setMessage('');
    } else if (response.error) {
      setMessage(response.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  return {
    dashboard,
    loading,
    dashboardError: message,
    loadDashboard,
    coops: dashboard?.coops ?? [],
    activeCoop: useMemo(() => selectActiveCoop(dashboard), [dashboard]),
    activeMember: useMemo(() => selectActiveMember(dashboard), [dashboard]),
    visibleDrafts: useMemo(() => selectAggregateVisibleDrafts(dashboard), [dashboard]),
    readyDrafts: useMemo(() => selectAggregateReadyDrafts(dashboard), [dashboard]),
    recentArtifacts: useMemo(() => selectAggregateArtifacts(dashboard), [dashboard]),
    activeCoopDrafts: useMemo(() => selectVisibleDrafts(dashboard), [dashboard]),
    activeCoopReadyDrafts: useMemo(() => selectReadyDrafts(dashboard), [dashboard]),
    activeCoopArtifacts: useMemo(() => selectRecentArtifacts(dashboard), [dashboard]),
  };
}
