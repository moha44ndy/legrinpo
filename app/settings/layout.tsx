import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Paramètres - Legrinpo',
  description: 'Gérez votre compte et vos préférences.',
};

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
