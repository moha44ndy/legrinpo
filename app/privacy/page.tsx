'use client';

import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <main className="help-page privacy-page">
      <div className="help-page-inner">
        <h1>Politique de confidentialité</h1>
        <p className="help-intro">
          Dernière mise à jour : mars 2025. Legrinpo (&quot;nous&quot;) s&apos;engage à protéger vos données personnelles.
        </p>

        <section className="help-section">
          <h2>1. Responsable du traitement</h2>
          <p>
            Les données sont traitées par Legrinpo. Pour toute question :{' '}
            <a href="mailto:legrinpo@gmail.com" className="privacy-link">legrinpo@gmail.com</a>.
          </p>
        </section>

        <section className="help-section">
          <h2>2. Données collectées</h2>
          <p>Nous collectons les données nécessaires au fonctionnement de l&apos;application :</p>
          <ul className="privacy-list">
            <li><strong>Compte</strong> : adresse e-mail, identifiant, mot de passe (stocké de manière sécurisée et chiffrée).</li>
            <li><strong>Profil</strong> : nom d&apos;utilisateur, photo de profil (avatar) si vous en ajoutez une.</li>
            <li><strong>Contenus</strong> : messages et discussions dans les canaux et le chat.</li>
            <li><strong>Portefeuille</strong> : soldes, historiques de transactions et de retraits, dans le cadre du service.</li>
            <li><strong>Support</strong> : sujets et messages envoyés via la page Aide.</li>
            <li><strong>Techniques</strong> : adresse IP, type d&apos;appareil, données de connexion (logs) pour la sécurité et le bon fonctionnement.</li>
          </ul>
        </section>

        <section className="help-section">
          <h2>3. Finalités et bases légales</h2>
          <p>
            Vos données sont utilisées pour fournir et sécuriser le service (comptes, discussions, portefeuille, support),
            respecter nos obligations légales et, le cas échéant, vous envoyer des informations importantes sur le service.
            La publicité (ex. bandeaux) peut utiliser des données de navigation conformément à la politique de nos partenaires (voir cookies).
          </p>
          <p>
            Les traitements reposent sur l&apos;exécution du contrat (utilisation de l&apos;app), votre consentement lorsque la loi l&apos;exige (cookies, publicité),
            et nos intérêts légitimes (sécurité, amélioration du service).
          </p>
        </section>

        <section className="help-section">
          <h2>4. Destinataires et hébergement</h2>
          <p>
            Les données sont hébergées et traitées via des prestataires techniques (hébergement, base de données, stockage de fichiers)
            qui agissent selon nos instructions et des engagements de confidentialité. En utilisant l&apos;application sur iPhone ou iPad,
            Apple peut traiter certaines données selon sa propre politique. Les publicités affichées dans l&apos;app peuvent reposer sur des
            technologies fournies par des tiers (ex. Google) ; leurs pratiques sont décrites dans leurs politiques respectives.
          </p>
        </section>

        <section className="help-section">
          <h2>5. Durée de conservation</h2>
          <p>
            Nous conservons vos données tant que votre compte est actif et, après clôture, pendant la durée nécessaire à nos obligations
            légales et à la résolution de litiges (par ex. comptabilité, réclamations). Les logs de sécurité et de connexion sont conservés
            pendant une durée limitée. Au-delà, les données sont supprimées ou anonymisées.
          </p>
        </section>

        <section className="help-section">
          <h2>6. Vos droits</h2>
          <p>
            Vous disposez d&apos;un droit d&apos;accès, de rectification, d&apos;effacement, à la limitation du traitement, à la portabilité
            et d&apos;opposition dans les conditions prévues par la réglementation (RGPD). Pour les exercer : contactez-nous à{' '}
            <a href="mailto:legrinpo@gmail.com" className="privacy-link">legrinpo@gmail.com</a>. Vous pouvez également introduire
            une réclamation auprès de la CNIL (ou de l&apos;autorité de contrôle de votre pays).
          </p>
        </section>

        <section className="help-section">
          <h2>7. Cookies et stockage local</h2>
          <p>
            L&apos;application et le site peuvent utiliser des cookies et du stockage local (navigateur ou appareil) pour la session,
            les préférences et le bon fonctionnement (ex. connexion, cache). Des cookies ou identifiants tiers peuvent être utilisés
            pour la publicité (ex. Google AdSense) ; vous pouvez gérer vos préférences via les paramètres de votre navigateur ou appareil.
          </p>
        </section>

        <section className="help-section">
          <h2>8. Sécurité et mineurs</h2>
          <p>
            Nous mettons en œuvre des mesures techniques et organisationnelles pour protéger vos données. Le service n&apos;est pas
            destiné aux mineurs ; nous ne collectons pas sciemment de données d&apos;enfants. Si vous constatez qu&apos;un mineur nous
            a communiqué des données, contactez-nous pour qu&apos;elles soient supprimées.
          </p>
        </section>

        <section className="help-section">
          <h2>9. Modifications</h2>
          <p>
            Nous pouvons mettre à jour cette politique. La date de dernière mise à jour sera indiquée en tête de page. Une modification
            importante vous sera signalée, le cas échéant, par e-mail ou dans l&apos;application. La poursuite de l&apos;utilisation
            après publication vaut acceptation des changements.
          </p>
        </section>

        <section className="help-section">
          <h2>10. Nous contacter</h2>
          <p>
            Pour toute question sur vos données ou cette politique :{' '}
            <a href="mailto:legrinpo@gmail.com" className="privacy-link">legrinpo@gmail.com</a>. Vous pouvez aussi utiliser la page{' '}
            <Link href="/help" className="privacy-link">Aide</Link> pour nous joindre.
          </p>
        </section>

        <p className="help-back">
          <Link href="/canaldiscussion">← Retour aux canaux</Link>
        </p>
      </div>
    </main>
  );
}
