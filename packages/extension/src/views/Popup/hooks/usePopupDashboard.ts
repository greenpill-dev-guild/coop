import { useCallback, useEffect, useMemo, useState } from 'react';
import { type DashboardResponse, sendRuntimeMessage } from '../../../runtime/messages';
import {
  selectActiveCoop,
  selectActiveMember,
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
    activeCoop: useMemo(() => selectActiveCoop(dashboard), [dashboard]),
    activeMember: useMemo(() => selectActiveMember(dashboard), [dashboard]),
    visibleDrafts: useMemo(() => selectVisibleDrafts(dashboard), [dashboard]),
    readyDrafts: useMemo(() => selectReadyDrafts(dashboard), [dashboard]),
    recentArtifacts: useMemo(() => selectRecentArtifacts(dashboard), [dashboard]),
  };
}
