import { Footer } from "@/components/Footer";

export const metadata = { title: "Obchodné podmienky" };

export default function TermsPage() {
  return (
    <div className="overflow-x-hidden">
      <main className="section py-12">
        <div className="mx-auto max-w-3xl">
        <h1 className="font-heading text-4xl uppercase tracking-tight text-white sm:text-5xl">
          Obchodné podmienky
        </h1>
        <div className="mt-6 space-y-6 text-[15px] leading-relaxed text-[#B5B5B5]">
          <Section title="1. Objednávka">
            Objednávku je možné vytvoriť cez web pre zvolenú prevádzku. Ceny sú
            uvedené v eurách vrátane DPH. Rozhodujúca je cena vypočítaná na
            serveri v čase objednávky.
          </Section>
          <Section title="2. Platba">
            Online platby nie sú dostupné. Platí sa v hotovosti alebo kartou pri
            odbere/doručení podľa možností prevádzky.
          </Section>
          <Section title="3. Doručenie a odber">
            Doručujeme v rámci uvedených rozvozových zón. Mimo zón ponúkame
            osobný odber. Odhadovaný čas prípravy/doručenia je orientačný a
            závisí od vyťaženia kuchyne.
          </Section>
          <Section title="4. Dostupnosť">
            Prevádzka môže objednávky dočasne pozastaviť (napr. do vypredania).
            V takom prípade nie je možné vytvoriť objednávku.
          </Section>
          <Section title="5. Storno a reklamácie">
            Objednávku je možné stornovať telefonicky do začatia prípravy.
            Prípadné reklamácie riešime bezodkladne telefonicky alebo e-mailom.
          </Section>
          <Section title="6. Účet">
            Za bezpečnosť prihlasovacích údajov zodpovedá používateľ. Účet je
            možné kedykoľvek vymazať vo svojom profile.
          </Section>
        </div>
        <p className="mt-8 text-xs text-neutral-500">
          Vzorový dokument — pred spustením doplňte fakturačné údaje a nechajte
          skontrolovať právnikovi.
        </p>
        </div>
      </main>
      <Footer />
    </div>
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
