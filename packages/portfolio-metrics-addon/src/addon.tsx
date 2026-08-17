import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AddonContext, AddonEnableFunction } from '@wealthfolio/addon-sdk';
import { MetricsDashboard } from './components/metrics-dashboard';

// The host owns a single React root per addon and mounts the route `component`
// itself (`createElement(Component, { location })`) with no access to the addon
// context. Capture it at enable time so the route wrapper can hand it down.
let addonCtx: AddonContext | undefined;

// Route component wrapping the dashboard with the addon's isolated QueryClient
const AddonRoute = () => {
  if (!addonCtx) {
    return <div className="p-6 text-sm text-muted-foreground">Loading addon context...</div>;
  }

  const queryClient = addonCtx.api.query.getClient() as QueryClient;

  return (
    <QueryClientProvider client={queryClient}>
      <MetricsDashboard api={addonCtx.api} />
    </QueryClientProvider>
  );
};

const enable: AddonEnableFunction = (ctx) => {
  addonCtx = ctx;

  // The route `id` MUST match `contributes.routes[].id` in manifest.json.
  ctx.router.add({
    id: 'portfolio-metrics',
    path: '/addons/portfolio-metrics',
    component: AddonRoute,
  });

  ctx.onDisable(() => {
    addonCtx = undefined;
  });
};

export default enable;
