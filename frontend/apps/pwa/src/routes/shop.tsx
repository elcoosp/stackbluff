import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';

const ShopPage = lazy(() => import('../pages/ShopPage'));

export const shopRoute: RouteObject = {
  path: '/shop',
  element: <ShopPage />,
};
