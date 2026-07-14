import { BadgeDisplay } from '../components/BadgeDisplay';
import { Trans } from '@lingui/react/macro';

export function ProfilePage() {
  return (
    <div className="profile-page">
      <h1><Trans>Profile</Trans></h1>
      <BadgeDisplay showProgress={true} />
    </div>
  );
}
