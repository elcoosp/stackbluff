import { createFileRoute } from '@tanstack/react-router';
import ShopPage from '../pages/ShopPage';

export const Route = createFileRoute('/shop')({
  component: ShopPage,
});
