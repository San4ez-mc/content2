export const metadata = { title: "Privacy Policy — FINEKO Content Platform" };

const CONTACT_EMAIL = "olexandrmatsuk@gmail.com";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-canvas text-fg">
      <div className="max-w-3xl mx-auto px-5 py-10 space-y-6 text-sm leading-relaxed">
        <h1 className="text-xl font-semibold">Privacy Policy</h1>
        <p className="text-fg-muted">FINEKO Content Platform — content2.fineko.space. Last updated: 17 October 2026.</p>

        <section className="space-y-2">
          <h2 className="font-semibold">Who we are</h2>
          <p>FINEKO Content Platform is a tool for planning, generating and publishing content to social network accounts that belong to the person using it. It is operated by FINEKO (Oleksandr Matsuk) and is used, among other accounts, to publish short videos for the KIRO project — the “Kiro” TikTok app and the KIRO TikTok account. Contact: <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold">What data we process</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Platform account data: name, email address and the content you create in the platform (texts, videos, schedules).</li>
            <li>When you connect TikTok: your TikTok open ID, display name and avatar (scope <code>user.info.basic</code>) and the access and refresh tokens that let us publish videos on your behalf (scope <code>video.publish</code>).</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold">How we use it</h2>
          <p>We use TikTok data only to show you which TikTok account you are posting to and to publish the videos that you explicitly choose and confirm in the publishing dialog. We do not publish anything without your confirmation, we do not read your TikTok messages, followers or other private data, we do not sell or share your data with third parties, and we do not use it for advertising. Data is sent only to the services needed to operate the platform (for example TikTok’s API when you publish).</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold">Storage, retention and deletion</h2>
          <p>Tokens and account data are kept in a restricted-access database on our server and only for as long as the integration is connected. You can disconnect at any time: revoke access in TikTok under Settings → Security &amp; permissions → Apps and services, and/or email us to delete your data. We delete it within 30 days of your request.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold">Your rights</h2>
          <p>You may request access to, correction or deletion of your data at any time by emailing <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
        </section>

        <hr className="border-border" />

        <h2 className="text-lg font-semibold">Політика конфіденційності (українською)</h2>
        <p>FINEKO Content Platform — інструмент для планування, генерації й публікації контенту в акаунти соцмереж, що належать користувачеві. Оператор — FINEKO (Олександр Мацук); платформа використовується, зокрема, для публікації коротких відео проєкту KIRO (застосунок «Kiro» у TikTok і акаунт KIRO). Зв’язок: <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
        <p>Ми обробляємо дані облікового запису (імʼя, email, створений контент), а при підключенні TikTok — open ID, імʼя й аватар акаунта та токени доступу, щоб публікувати лише ті відео, які ви самі обрали й підтвердили у вікні публікації. Ми нічого не публікуємо без вашого підтвердження, не продаємо й не передаємо дані третім особам, не використовуємо їх для реклами.</p>
        <p>Дані зберігаються у базі з обмеженим доступом, поки підключення активне. Ви можете відкликати доступ у налаштуваннях TikTok (Settings → Security &amp; permissions → Apps and services) і попросити видалити дані листом — ми видаляємо їх протягом 30 днів.</p>
      </div>
    </main>
  );
}
