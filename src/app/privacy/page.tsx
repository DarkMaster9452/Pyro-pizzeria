import { Footer } from "@/components/Footer";

export const metadata = { title: "Ochrana súkromia" };

export default function PrivacyPage() {
  return (
    <main className="section py-12">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-heading text-4xl uppercase tracking-tight text-white sm:text-5xl">
          Ochrana súkromia
        </h1>
        <div className="mt-6 space-y-6 text-[15px] leading-relaxed text-[#B5B5B5]">
          <Section title="1. Prevádzkovateľ">
            Prevádzkovateľom osobných údajov sú prevádzky Pyro Pizzeria (Kamenná
            Poruba) a Polomárik (Stráňavy). Kontakt nájdete na stránke Kontakt.
          </Section>
          <Section title="2. Aké údaje spracúvame">
            Meno, e-mail, telefón a doručovaciu adresu — výhradne za účelom
            spracovania a doručenia objednávky. Heslá ukladáme iba v podobe
            bezpečného hašu (Argon2id), nikdy nie v čitateľnej forme.
          </Section>
          <Section title="3. Právny základ a účel">
            Údaje spracúvame na základe plnenia zmluvy (vybavenie objednávky) a
            vášho súhlasu pri registrácii. Údaje nepoužívame na profilovanie ani
            ich nepredávame tretím stranám.
          </Section>
          <Section title="4. Doba uchovávania">
            Údaje objednávok uchovávame po dobu nevyhnutnú na účtovné a daňové
            povinnosti. Účet a s ním spojené údaje môžete kedykoľvek vymazať.
          </Section>
          <Section title="5. Vaše práva (GDPR)">
            Máte právo na prístup, opravu, vymazanie a prenosnosť údajov. Vo
            svojom účte nájdete možnosť <strong>Exportovať údaje</strong> a{" "}
            <strong>Zmazať účet</strong>. Máte tiež právo namietať a podať
            sťažnosť dozornému orgánu (Úrad na ochranu osobných údajov SR).
          </Section>
          <Section title="6. Cookies">
            Používame nevyhnutné cookies (prihlásenie, košík) a voliteľné cookies
            na zlepšovanie služieb. Súhlas spravujete cez cookie lištu.
          </Section>
        </div>
        <p className="mt-8 text-xs text-neutral-500">
          Toto je vzorový dokument. Pred ostrým spustením ho dajte skontrolovať
          právnikovi a doplňte fakturačné údaje prevádzkovateľa.
        </p>
      </div>
      <Footer />
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 font-display text-lg font-bold text-white">{title}</h2>
      <p>{children}</p>
    </section>
  );
}
