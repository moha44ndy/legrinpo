import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Politique de confidentialité - Legrinpo',
  description: 'Politique de confidentialité et protection des données personnelles de l\'application Legrinpo.',
};

export default function PrivacyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
