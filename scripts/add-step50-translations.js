const fs = require('fs');
const path = require('path');

function forceKeys(filePath, keys) {
  const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  for (const [ns, vals] of Object.entries(keys)) {
    if (!content[ns]) content[ns] = {};
    for (const [k, v] of Object.entries(vals)) {
      content[ns][k] = v;
    }
  }
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n', 'utf-8');
  console.log('Updated:', filePath);
}

forceKeys(path.join(__dirname, '..', 'src', 'messages', 'nl.json'), {
  notifications: {
    title: 'E-mail & meldingen',
    overdueSection: 'Achterstallig',
    upcomingSection: 'Binnenkort',
    achievementsSection: 'Prestaties',
    noNotifications: 'Geen meldingen',
    allGood: 'Alles is op orde!',
    clearAll: 'Alles wissen',
    cleared: 'Gewist',
    digest_label: 'Wekelijks overzicht',
    digest_desc: 'Ontvang elke week een samenvatting per e-mail',
    welcome_label: 'Welkomst e-mails',
    welcome_desc: 'Ontvang onboarding e-mails na registratie',
    features_label: 'Functie updates',
    features_desc: 'E-mails over nieuwe functies en tips',
    push_label: 'Push meldingen',
    push_desc: 'Ontvang herinneringen op je apparaat',
  },
  referral: {
    title: 'Vrienden uitnodigen',
    desc: 'Deel PayWatch met vrienden. Hoe meer je deelt, hoe meer functies je ontgrendelt.',
    shareLink: 'Jouw uitnodigingslink',
    copied: 'Gekopieerd!',
    shareButton: 'Deel met een vriend',
    friendsReferred: 'Vrienden uitgenodigd',
    statusPending: 'Wachtend',
    statusCompleted: 'Voltooid',
    unlockTitle: 'Nodig een vriend uit',
    unlockDesc: 'Deel PayWatch met een vriend. Zodra zij een account aanmaken, krijgen jullie allebei toegang tot alle functies.',
    tier1: '1 vriend = alle functies + 10 extra brieven & inzichten',
    tier2: '2 vrienden = 20 extra brieven & inzichten',
    tier3: '3+ vrienden = onbeperkt toegang',
    letterLimit: 'Je hebt al je gratis brieven gebruikt. Nodig een vriend uit voor meer.',
    insightLimit: 'Je hebt al je gratis AI-inzichten gebruikt. Nodig een vriend uit voor meer.',
  },
});

forceKeys(path.join(__dirname, '..', 'src', 'messages', 'en.json'), {
  notifications: {
    title: 'Email & notifications',
    overdueSection: 'Overdue',
    upcomingSection: 'Upcoming',
    achievementsSection: 'Achievements',
    noNotifications: 'No notifications',
    allGood: 'Everything is on track!',
    clearAll: 'Clear all',
    cleared: 'Cleared',
    digest_label: 'Weekly digest',
    digest_desc: 'Receive a weekly summary by email',
    welcome_label: 'Welcome emails',
    welcome_desc: 'Receive onboarding emails after registration',
    features_label: 'Feature updates',
    features_desc: 'Emails about new features and tips',
    push_label: 'Push notifications',
    push_desc: 'Receive reminders on your device',
  },
  referral: {
    title: 'Invite friends',
    desc: 'Share PayWatch with friends. The more you share, the more features you unlock.',
    shareLink: 'Your invite link',
    copied: 'Copied!',
    shareButton: 'Share with a friend',
    friendsReferred: 'Friends invited',
    statusPending: 'Pending',
    statusCompleted: 'Completed',
    unlockTitle: 'Invite a friend',
    unlockDesc: 'Share PayWatch with a friend. When they create an account, you both unlock all features.',
    tier1: '1 friend = all features + 10 extra letters & insights',
    tier2: '2 friends = 20 extra letters & insights',
    tier3: '3+ friends = unlimited access',
    letterLimit: "You've used all your free letters. Invite a friend for more.",
    insightLimit: "You've used all your free AI insights. Invite a friend for more.",
  },
});

console.log('Done! Notification + referral translations added.');
