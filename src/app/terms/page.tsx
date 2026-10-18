export const metadata = { title: "Terms of Service — FINEKO Content Platform" };

const CONTACT_EMAIL = "olexandrmatsuk@gmail.com";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-canvas text-fg">
      <div className="max-w-3xl mx-auto px-5 py-10 space-y-6 text-sm leading-relaxed">
        <h1 className="text-xl font-semibold">Terms of Service</h1>
        <p className="text-fg-muted">FINEKO Content Platform — content2.fineko.space. Last updated: 17 October 2026.</p>

        <section className="space-y-2">
          <h2 className="font-semibold">1. The service</h2>
          <p>FINEKO Content Platform helps you plan, generate and publish content to social network accounts that you own or are authorised to manage. By using it you agree to these terms. The platform is operated by FINEKO (Oleksandr Matsuk) and is used, among other accounts, to publish short videos for the KIRO project (the “Kiro” TikTok app and the KIRO TikTok account).</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold">2. Your responsibilities</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>You use the platform only with accounts you own or are authorised to manage, and you are responsible for the content you publish.</li>
            <li>You comply with the terms and policies of each social network you connect, including TikTok’s Terms of Service, Community Guidelines and Music Usage Confirmation (and the Branded Content Policy where you disclose promotional content).</li>
            <li>You do not use the platform for unlawful, misleading or infringing content, or for spam.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold">3. Publishing to TikTok</h2>
          <p>Videos are published to TikTok only after you choose the visibility and interaction settings in the publishing dialog and confirm. You can disconnect TikTok at any time in your TikTok settings (Settings → Security &amp; permissions → Apps and services).</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold">4. Availability and liability</h2>
          <p>The service is provided “as is”, without warranties. We do not guarantee uninterrupted operation or that a particular post will be accepted or shown by a social network. To the extent permitted by law, we are not liable for indirect losses arising from use of the service.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold">5. Termination and changes</h2>
          <p>We may suspend access in case of misuse. You may stop using the service and request deletion of your data at any time (see our <a className="underline" href="/privacy">Privacy Policy</a>). We may update these terms; continued use means acceptance.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold">6. Contact</h2>
          <p><a className="underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
        </section>

        <hr className="border-border" />

        <h2 className="text-lg font-semibold">Умови користування (українською)</h2>
        <p>FINEKO Content Platform допомагає планувати, генерувати й публікувати контент в акаунти соцмереж, якими ви володієте або керуєте за дорученням. Платформу веде FINEKO (Олександр Мацук); вона використовується, зокрема, для публікації коротких відео проєкту KIRO (застосунок «Kiro» у TikTok і акаунт KIRO). Ви відповідаєте за контент, дотримуєтесь правил кожної соцмережі (для TikTok — Terms of Service, Community Guidelines, Music Usage Confirmation, а для реклами — Branded Content Policy) і не використовуєте сервіс для незаконного, оманливого чи спам-контенту.</p>
        <p>Відео публікуються в TikTok лише після того, як ви обрали налаштування у вікні публікації й підтвердили. Сервіс надається «як є», без гарантій безперебійної роботи. Ви можете припинити користування й попросити видалити дані будь-коли (див. <a className="underline" href="/privacy">Політику конфіденційності</a>). Зв’язок: <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
      </div>
    </main>
  );
}
