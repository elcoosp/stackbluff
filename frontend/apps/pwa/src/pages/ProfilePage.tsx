import { Trans } from '@lingui/react/macro';
import { BadgeDisplay } from '../components/BadgeDisplay';

export function ProfilePage() {
  return (
    <div className="profile-page">
      <h1>
        <Trans>Profile</Trans>
      </h1>
      <BadgeDisplay showProgress={true} />
    </div>
  );
}
