import Link from "next/link";

export default function NotFound() {
  return (
    <main className="section flex min-h-[80vh] flex-col items-center justify-center text-center">
      <div className="text-7xl">🍕</div>
      <h1 className="mt-4 font-display text-5xl font-extrabold text-brand-primary">
        404
      </h1>
      <p className="mt-2 text-lg font-semibold">Túto stránku sme nenašli</p>
      <p className="mt-1 text-neutral-500">
        Možno bola zjedená. Vráťte sa a objednajte si novú.
      </p>
      <Link href="/" className="btn-primary mt-6">
        Späť na domovskú stránku
      </Link>
    </main>
  );
}
