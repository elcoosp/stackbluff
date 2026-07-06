import { BadgeDisplay } from '../components/BadgeDisplay';

export function ProfilePage() {
  return (
    <div className="profile-page">
      <h1>Profile</h1>
      <BadgeDisplay showProgress={true} />
    </div>
  );
}
