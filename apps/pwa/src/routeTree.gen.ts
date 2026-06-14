import { Route as rootRoute } from './routes/__root';
import { Route as IndexRoute } from './routes/index';
import { Route as TableTableIdRoute } from './routes/table/$tableId';
declare module '@tanstack/react-router' {
  interface FileRoutesByPath {
    '/': typeof IndexRoute;
    '/table/$tableId': typeof TableTableIdRoute;
  }
}
export const routeTree = rootRoute.addChildren({
  '/': IndexRoute,
  '/table/$tableId': TableTableIdRoute,
});
