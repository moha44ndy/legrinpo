'use client';

import Link from 'next/link';

export default function TermsPage() {
  return (
    <main className="help-page privacy-page">
      <div className="help-page-inner">
        <p className="help-back help-back-top">
          <Link href="/settings">← Retour</Link>
        </p>
        <h1>Conditions d&apos;utilisation</h1>
        <p className="help-intro">
          Dernière mise à jour : mai 2026. En utilisant Legrinpo, vous acceptez les présentes conditions.
        </p>

        <section className="help-section">
          <h2>1. Objet</h2>
          <p>
            Legrinpo est une plateforme de discussion communautaire permettant d&apos;échanger des messages texte,
            vocaux et des fichiers dans des canaux publics ou privés. Les contenus publiés par les utilisateurs
            sont de leur responsabilité.
          </p>
        </section>

        <section className="help-section">
          <h2>2. Comportement acceptable</h2>
          <p>Vous vous engagez à ne pas publier ni partager de contenus ou comportements :</p>
          <ul className="privacy-list">
            <li>illégaux, violents, haineux, discriminatoires ou diffamatoires ;</li>
            <li>harcelants, menaçants ou portant atteinte à la vie privée d&apos;autrui ;</li>
            <li>à caractère sexuel impliquant des mineurs ou non consenti ;</li>
            <li>usurpant l&apos;identité d&apos;une personne ou organisation.</li>
          </ul>
        </section>

        <section className="help-section">
          <h2>3. Modération</h2>
          <p>
            Nous nous réservons le droit de supprimer tout contenu, restreindre l&apos;accès à un salon ou suspendre
            un compte en cas de non-respect de ces règles. Vous pouvez signaler un message depuis le menu du message
            dans le chat, bloquer un utilisateur abusif, ou nous contacter via la page Aide.
          </p>
        </section>

        <section className="help-section">
          <h2>4. Signalement et blocage</h2>
          <p>
            La fonction « Signaler ce message » permet d&apos;alerter notre équipe de modération. La fonction
            « Bloquer cet utilisateur » masque immédiatement ses messages sur votre appareil et empêche toute
            interaction directe via l&apos;application.
          </p>
        </section>

        <section className="help-section">
          <h2>5. Portefeuille</h2>
          <p>
            Le portefeuille sert à gérer des montants liés à l&apos;utilisation de la plateforme et à des retraits
            vers des moyens de paiement externes. Il ne permet pas l&apos;achat de contenus numériques dans
            l&apos;application.
          </p>
        </section>

        <section className="help-section">
          <h2>6. Responsabilité</h2>
          <p>
            Legrinpo n&apos;est pas responsable des contenus publiés par les utilisateurs. En cas de litige,
            contactez-nous à{' '}
            <a href="mailto:legrinpo@gmail.com" className="privacy-link">legrinpo@gmail.com</a>.
          </p>
        </section>

        <section className="help-section">
          <h2>7. Acceptation</h2>
          <p>
            L&apos;accès aux discussions et à tout contenu généré par les utilisateurs est conditionné à
            l&apos;acceptation de ces conditions. Sans acceptation, vous ne pouvez pas accéder aux salons de
            discussion.
          </p>
        </section>

        <p className="help-back">
          <Link href="/privacy">Politique de confidentialité</Link>
        </p>
      </div>
    </main>
  );
}
