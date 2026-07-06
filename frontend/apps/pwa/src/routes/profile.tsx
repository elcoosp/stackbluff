import { createFileRoute } from '@tanstack/react-router';
import { BadgeSection } from '../components/profile/BadgeSection';

export const Route = createFileRoute('/profile')({
  component: ProfilePage,
});

function ProfilePage() {
  return (
    <div className="min-h-screen bg-background p-6">
      <h1 className="text-2xl font-bold mb-6">Profile</h1>
      <div className="max-w-md space-y-6">
        <BadgeSection />
      </div>
    </div>
  );
}
